/**
 * ROVER backfill discovery — the BIG full-sweep pass over the RAV back-catalogue.
 *
 * Drives the n8n "ROVER backfill discovery" webhook (`ops/n8n/rover-backfill.json`),
 * paging the grid ASC by approval number a batch at a time, and upserts each discovered
 * towing-relevant approval into RoverApprovalIndex as a skeleton row (expandState defaults
 * UNFETCHED). n8n does the ROVER grid fetch on the AU VPN — **this process never touches
 * ROVER** (it only calls n8n + the local DB). DISCOVERY ONLY: detail/specs come from the
 * separate expand pass (rover-expand-bulk-local.ts), which then picks up these new rows.
 *
 * Idempotent/resumable: upsert by vtaNumber (never clobbers expandState), and `--start-page`
 * resumes a stopped sweep. Polite: jitter between batches, escalating backoff that honours
 * Retry-After on a 403/429/503, aborts on a persistent block.
 *
 * Usage:
 *   N8N_BASE_URL=… DATABASE_URL=… npx tsx src/jobs/rover-backfill-discover-local.ts
 *   …                                   --start-page=120 --pages=10 --page-size=50
 *
 * Run AFTER the expand pass finishes (don't double live-portal load), then run expand
 * again to fetch detail for the newly discovered rows, then promote.
 */
import { prisma } from '../lib/db';

const argv = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const h = argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const N8N = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '');
const WEBHOOK =
  process.env.ROVER_BACKFILL_WEBHOOK_URL || `${N8N}/webhook/rover-backfill`;
const PAGES = parseInt(opt('pages', '10'), 10); // grid pages per webhook call (n8n caps at 25)
const PAGE_SIZE = parseInt(opt('page-size', '50'), 10);
const MIN_S = parseInt(opt('min', '5'), 10); // jitter between batches
const MAX_S = parseInt(opt('max', '12'), 10);
const REQ_TIMEOUT_MS = parseInt(opt('timeout', '180'), 10) * 1000;
const MAX_PAGES = parseInt(opt('max-pages', '300'), 10); // safety cap on total pages swept
const BLOCK_BACKOFFS_MIN = [1, 2, 5, 10, 20];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitterMs = () =>
  (MIN_S + Math.random() * Math.max(0, MAX_S - MIN_S)) * 1000;

type SkelRow = {
  approvalId?: string;
  vta?: string;
  make?: string | null;
  model?: string | null;
  category?: string | null;
  lastUpdatedMs?: number | null;
};
type PageResult = {
  outcome: 'ok' | 'block';
  rows?: SkelRow[];
  nextPage?: number | null;
  done?: boolean;
  retryAfterS?: number;
};

async function fetchBatch(startPage: number): Promise<PageResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startPage, pages: PAGES, pageSize: PAGE_SIZE }),
      signal: ctrl.signal,
    });
  } catch {
    return { outcome: 'block' };
  } finally {
    clearTimeout(timer);
  }
  if ([403, 429, 503].includes(res.status) || res.status >= 500)
    return { outcome: 'block' };
  let body: {
    ok?: boolean;
    rows?: SkelRow[];
    nextPage?: number | null;
    done?: boolean;
    blocked?: boolean;
    status?: number;
    retryAfter?: number;
    error?: string;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }
  if (body.ok)
    return {
      outcome: 'ok',
      rows: body.rows ?? [],
      nextPage: body.nextPage ?? null,
      done: !!body.done,
    };
  // ok:false — the n8n code caught a portal error (it forwards status + retryAfter)
  if (body.blocked || [403, 429, 503].includes(body.status ?? 0))
    return { outcome: 'block', retryAfterS: body.retryAfter ?? undefined };
  // a non-block error (layout change etc.) — surface it loudly and stop
  throw new Error(`backfill webhook error: ${body.error ?? 'unknown'}`);
}

async function upsertRows(rows: SkelRow[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (!r.vta || !r.approvalId) continue;
    const data = {
      approvalId: r.approvalId,
      make: r.make ?? null,
      model: r.model ?? null,
      category: r.category ?? null,
      lastUpdated: r.lastUpdatedMs ? new Date(r.lastUpdatedMs) : null,
    };
    await prisma.roverApprovalIndex.upsert({
      where: { vtaNumber: r.vta },
      update: data, // never touches expandState/normalization — only grid fields
      create: { vtaNumber: r.vta, ...data },
    });
    n += 1;
  }
  return n;
}

async function main() {
  if (!WEBHOOK || !N8N) {
    console.error('N8N_BASE_URL / ROVER_BACKFILL_WEBHOOK_URL not set — abort.');
    process.exit(1);
  }
  const before = await prisma.roverApprovalIndex.count();
  console.error(
    `ROVER backfill discovery — webhook ${WEBHOOK} · ${PAGES} pages/call · index has ${before} rows`,
  );

  let page = parseInt(opt('start-page', '1'), 10);
  let pagesSwept = 0;
  let upserted = 0;

  while (pagesSwept < MAX_PAGES) {
    let settled = false;
    for (let attempt = 0; attempt < BLOCK_BACKOFFS_MIN.length; attempt++) {
      const r = await fetchBatch(page);
      if (r.outcome === 'ok') {
        const n = await upsertRows(r.rows ?? []);
        upserted += n;
        pagesSwept += PAGES;
        console.error(
          `  pages ${page}..${page + PAGES - 1}: +${n} rows (total upserted ${upserted})${r.done ? ' · DONE' : ''}`,
        );
        if (r.done || r.nextPage == null) {
          settled = true;
          page = -1; // sentinel: finished
          break;
        }
        page = r.nextPage;
        settled = true;
        break;
      }
      // blocked
      const waitS = Math.max(
        r.retryAfterS ?? 0,
        BLOCK_BACKOFFS_MIN[attempt] * 60,
      );
      if (attempt === BLOCK_BACKOFFS_MIN.length - 1) {
        console.error(
          `CIRCUIT BREAKER: still rate-limited at page ${page} after ${attempt + 1} attempts — aborting. Re-run with --start-page=${page} to resume.`,
        );
        await prisma.$disconnect();
        process.exit(0);
      }
      console.error(
        `  ⚠ 429/block at page ${page} — backing off ${waitS}s` +
          (r.retryAfterS ? ` (Retry-After=${r.retryAfterS}s)` : '') +
          ` [attempt ${attempt + 1}/${BLOCK_BACKOFFS_MIN.length}]`,
      );
      await sleep(waitS * 1000);
    }
    if (!settled) break;
    if (page === -1) break; // done
    await sleep(jitterMs());
  }

  const after = await prisma.roverApprovalIndex.count();
  console.error(
    `\ndone — upserted ${upserted} skeleton rows; RoverApprovalIndex ${before} → ${after}. ` +
      `Now run rover-expand-bulk-local.ts to fetch detail for the new UNFETCHED rows, then promote.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
