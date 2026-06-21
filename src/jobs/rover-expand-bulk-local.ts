/**
 * Bulk RVD expansion of the ROVER skeleton — POLITE, VPN-only, resumable.
 *
 * Walks every UNFETCHED RoverApprovalIndex row and triggers the **n8n expand webhook**
 * (`ROVER_EXPAND_WEBHOOK_URL`) for each. n8n does the actual ROVER fetch on the AU VPN
 * egress and POSTs the HTML back to the app's /api/rover/ingest — **this process never
 * touches ROVER directly** (egress rule: never hit the federal portal from this box).
 * The app extracts + parses + gates → PENDING candidates, and flips the row to EXPANDED,
 * so the run is **idempotent/resumable**: re-running picks up whatever is still UNFETCHED.
 *
 * Politeness (Tim's call — "don't hammer it, back off + jitter", honour 429s):
 *   - jittered wait between calls (default min–max s, never metronomic)
 *   - on a 403/429/503 we STAY on that row and back off with an escalating schedule
 *     (1→2→5→10→20 min), honouring the portal's Retry-After when it sends one — we do
 *     NOT advance to the next approval while rate-limited (no extra pokes)
 *   - if a row is still rate-limited after the last backoff step, the run ABORTS
 *     (resume later; watermark is clean — EXPANDED rows are skipped on re-run)
 *   - `--cap=N` to limit a single run; `--min/--max` (seconds) to tune the throttle
 *
 * Promotion is SEPARATE (rover-promote-base-local.ts / rover-promote-gvm-upgrade-bulk-local.ts).
 *
 * Usage:
 *   APP_BASE_URL=… DATABASE_URL=… npx tsx src/jobs/rover-expand-bulk-local.ts
 *   …                                  --cap=200 --min=12 --max=25
 */
import { prisma } from '../lib/db';

const argv = process.argv.slice(2);
const opt = (n: string, d: string) => {
  const h = argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const WEBHOOK = process.env.ROVER_EXPAND_WEBHOOK_URL ?? '';
const TOKEN = process.env.ROVER_INGEST_TOKEN ?? '';
const APP = (process.env.APP_BASE_URL ?? 'https://tbr.dev.ragebots.me').replace(
  /\/$/,
  '',
);
const MIN_S = parseInt(opt('min', '8'), 10);
const MAX_S = parseInt(opt('max', '18'), 10);
const CAP = parseInt(opt('cap', '100000'), 10);
// Per-call timeout — a portal that throttles by HOLDING the connection (slow-loris)
// must not hang us forever; a timeout is treated as a block → escalating backoff.
const REQ_TIMEOUT_MS = parseInt(opt('timeout', '120'), 10) * 1000;
// Escalating backoff applied to a SINGLE blocked row (minutes). We stay on that row
// and wait longer each time rather than advancing (= poking the portal again). If a
// row is still blocked after the last step, the portal clearly doesn't want us → we
// abort the whole run (resumable). Retry-After, when the portal sends it, overrides.
const BLOCK_BACKOFFS_MIN = [1, 2, 5, 10, 20];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitterMs = () =>
  (MIN_S + Math.random() * Math.max(0, MAX_S - MIN_S)) * 1000;

type Probe = {
  outcome: 'ok' | 'soft' | 'block';
  retryAfterS?: number;
  tooBig?: boolean; // app ingest 413 — detail HTML exceeds nginx client_max_body_size
};

/** Parse a Retry-After header (delta-seconds form; HTTP-date form ignored). */
function parseRetryAfter(h: string | null | undefined): number | undefined {
  if (!h) return undefined;
  const n = parseInt(h, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function expandOne(approvalId: string, vta: string): Promise<Probe> {
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalId,
        vtaNumber: vta,
        appBaseUrl: APP,
        ingestToken: TOKEN,
      }),
      signal: ctrl.signal,
    });
  } catch {
    // timeout (abort) or network/n8n hiccup — treat as a block (back off)
    return { outcome: 'block' };
  } finally {
    clearTimeout(timer);
  }
  const headerRetry = parseRetryAfter(res.headers.get('retry-after'));
  // 403/429/503 → rate-limit/block. n8n currently THROWS on these → surfaces as 5xx
  // here; if it's later wired to forward the status + Retry-After, we honor those too.
  if ([403, 429, 503].includes(res.status) || res.status >= 500)
    return { outcome: 'block', retryAfterS: headerRetry };
  let body: {
    ok?: boolean;
    error?: string;
    status?: number;
    retryAfter?: number;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }
  if (body.ok) return { outcome: 'ok' };
  const e = String(body.error ?? '');
  const blockedStatus =
    body.status === 403 || body.status === 429 || body.status === 503;
  if (blockedStatus || /\b(403|429|503)\b|block|rate/i.test(e))
    return { outcome: 'block', retryAfterS: body.retryAfter ?? headerRetry };
  if (/\b413\b/.test(e)) return { outcome: 'soft', tooBig: true }; // nginx body limit
  return { outcome: 'soft' }; // e.g. a 404 detail page — skip it, not a portal block
}

async function main() {
  if (!WEBHOOK || !TOKEN) {
    console.error(
      'ROVER_EXPAND_WEBHOOK_URL / ROVER_INGEST_TOKEN not set — abort.',
    );
    process.exit(1);
  }
  const all = await prisma.roverApprovalIndex.findMany({
    where: { expandState: 'UNFETCHED' },
    select: { approvalId: true, vtaNumber: true },
    orderBy: { vtaNumber: 'asc' },
  });
  const rows = all.filter(
    (r): r is { approvalId: string; vtaNumber: string } => !!r.approvalId,
  );
  console.error(
    `ROVER bulk expand — ${rows.length} UNFETCHED · throttle ${MIN_S}-${MAX_S}s · cap ${CAP} · app ${APP}`,
  );

  let ok = 0;
  let soft = 0;
  let tooBig = 0;
  let done = 0;
  let aborted = false;

  for (const r of rows) {
    if (done >= CAP) {
      console.error(`reached cap ${CAP} — stopping (resumable).`);
      break;
    }

    // Try this row, escalating the backoff while it stays blocked. We do NOT advance
    // to the next approval while the portal is rate-limiting us.
    let settled = false;
    for (let attempt = 0; attempt < BLOCK_BACKOFFS_MIN.length; attempt++) {
      const probe = await expandOne(r.approvalId, r.vtaNumber);
      if (probe.outcome === 'ok') {
        ok += 1;
        settled = true;
        break;
      }
      if (probe.outcome === 'soft') {
        soft += 1;
        if (probe.tooBig) tooBig += 1;
        settled = true;
        break;
      }
      // blocked — honor Retry-After if the portal sent one, else escalating schedule
      const schedS = BLOCK_BACKOFFS_MIN[attempt] * 60;
      const waitS = Math.max(probe.retryAfterS ?? 0, schedS);
      if (attempt === BLOCK_BACKOFFS_MIN.length - 1) {
        console.error(
          `CIRCUIT BREAKER: ${r.vtaNumber} still rate-limited after ${attempt + 1} attempts — aborting the run to respect the portal. Re-run to resume (watermark is clean).`,
        );
        aborted = true;
        break;
      }
      console.error(
        `  ⚠ 429/block at ${r.vtaNumber} — backing off ${waitS}s` +
          (probe.retryAfterS
            ? ` (honoring Retry-After=${probe.retryAfterS}s)`
            : '') +
          ` [attempt ${attempt + 1}/${BLOCK_BACKOFFS_MIN.length}]`,
      );
      await sleep(waitS * 1000);
    }
    if (aborted) break;
    if (!settled) break; // safety: shouldn't happen (last attempt aborts)

    done += 1;
    if (done % 25 === 0)
      console.error(
        `  ${done}/${rows.length}  ok=${ok} soft=${soft} (413/too-big=${tooBig})`,
      );
    await sleep(jitterMs()); // polite gap between approvals
  }

  console.error(
    `\n${aborted ? 'ABORTED (rate-limited)' : 'done'} — processed ${done}: ok=${ok} soft(skipped)=${soft}` +
      ` of which ${tooBig} were 413/too-big (raise nginx client_max_body_size, then re-run to capture them).` +
      ` Remaining UNFETCHED resume on re-run.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
