/**
 * Bulk fetch + extract the Brave dork PDFs. [axle/spec discovery — extraction half]
 *
 * Reads the candidate list (ops/n8n/.brave-pdfs.jsonl), fetches each PDF in-here,
 * content-hash dedups (the same spec sheet is mirrored across dozens of sites), and
 * runs each through the local extract pipeline (pre-screen → docling/text → Qwen →
 * verdict). No known GVM is passed, so a doc with plausible front+rear axle comes
 * back `REVIEW` — that's the flag to look at. Pure DISCOVERY/review: writes results
 * to ops/n8n/.brave-extracted.jsonl, lands NOTHING in the DB (that's a later careful
 * step once we see which PDFs are real).
 *
 * Guards (lessons from earlier runaway jobs): per-PDF progress file, content-hash
 * dedup, a size cap (skip >MAXMB — a 60MB workshop manual is a time sink the
 * pre-screen would reject anyway), and a fetch timeout.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/brave-extract-local.ts        # all candidates
 *   …--limit=20      # only the first N (test)
 */
import {
  readFileSync,
  existsSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { extractManualSpecs } from '../lib/spec-fetch/manual/extract';

const args = process.argv.slice(2);
const LIMIT = Number(
  args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '999',
);
/** --incremental: keep prior results, only fetch+extract candidate URLs not already done. */
const INCREMENTAL = args.includes('--incremental');
const IN = 'ops/n8n/.brave-pdfs.jsonl';
const OUT = 'ops/n8n/.brave-extracted.jsonl';
const PROGRESS = 'ops/n8n/.brave-extract-progress.log';
const MAXMB = 45;
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface Cand {
  vehicle: string;
  url: string;
  title: string;
}

function progress(msg: string): void {
  try {
    appendFileSync(PROGRESS, `${new Date().toISOString()}  ${msg}\n`);
  } catch {
    /* ignore */
  }
  console.log(msg);
}

async function fetchPdf(
  url: string,
): Promise<
  { bytes: Uint8Array; note: string } | { bytes: null; note: string }
> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return { bytes: null, note: `http ${r.status}` };
    const len = Number(r.headers.get('content-length') ?? '0');
    if (len > MAXMB * 1e6)
      return { bytes: null, note: `too big ${(len / 1e6) | 0}MB` };
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > MAXMB * 1e6)
      return { bytes: null, note: `too big ${(buf.length / 1e6) | 0}MB` };
    const magic = Buffer.from(buf.slice(0, 5)).toString('latin1');
    if (magic !== '%PDF-') return { bytes: null, note: 'not a pdf' };
    return { bytes: buf, note: `pdf ${(buf.length / 1e6).toFixed(1)}MB` };
  } catch (e) {
    return { bytes: null, note: (e as Error).message.slice(0, 50) };
  }
}

async function main() {
  if (!existsSync(IN))
    throw new Error(`${IN} not found — run brave-pdf-search-local.ts first.`);
  let cands = readFileSync(IN, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cand);

  // Incremental: load URLs already in OUT, skip them, append the rest.
  const doneUrls = new Set<string>();
  if (INCREMENTAL && existsSync(OUT)) {
    for (const line of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) {
      try {
        doneUrls.add((JSON.parse(line) as { url: string }).url);
      } catch {
        /* skip */
      }
    }
    cands = cands.filter((c) => !doneUrls.has(c.url));
  } else {
    writeFileSync(OUT, '');
  }
  cands = cands.slice(0, LIMIT);

  writeFileSync(PROGRESS, '');
  progress(
    `=== BRAVE EXTRACT${INCREMENTAL ? ' [incremental]' : ''} · ${cands.length} candidate PDFs` +
      (doneUrls.size ? ` (${doneUrls.size} already done, skipped)` : '') +
      ' ===',
  );

  const seenHash = new Set<string>();
  let fetched = 0;
  let dupes = 0;
  let withAxle = 0;
  const counts: Record<string, number> = {};

  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const host = (() => {
      try {
        return new URL(c.url).host.replace(/^www\./, '');
      } catch {
        return '?';
      }
    })();
    const f = await fetchPdf(c.url);
    if (!f.bytes) {
      progress(
        `  ${i + 1}/${cands.length} [${c.vehicle}] ${host} → skip (${f.note})`,
      );
      continue;
    }
    const hash = createHash('sha256').update(f.bytes).digest('hex');
    if (seenHash.has(hash)) {
      dupes += 1;
      progress(
        `  ${i + 1}/${cands.length} [${c.vehicle}] ${host} → dup content, skip`,
      );
      continue;
    }
    seenHash.add(hash);
    fetched += 1;

    let verdict = 'ERROR';
    let specs: Record<string, number | null> = {};
    try {
      const res = await extractManualSpecs(f.bytes, {});
      verdict = res.verdict;
      specs = res.specs as unknown as Record<string, number | null>;
    } catch (e) {
      verdict = `ERROR:${(e as Error).message.slice(0, 30)}`;
    }
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    const front = specs.frontAxleLimitKg;
    const rear = specs.rearAxleLimitKg;
    if (front != null && rear != null) withAxle += 1;
    progress(
      `  ${i + 1}/${cands.length} [${c.vehicle}] ${host} (${f.note}) → ${verdict}` +
        (front != null || rear != null
          ? `  AXLE F/R ${front ?? '—'}/${rear ?? '—'} gvm ${specs.gvmKg ?? '—'}`
          : ''),
    );
    appendFileSync(OUT, JSON.stringify({ ...c, host, verdict, specs }) + '\n');
  }

  progress(
    `\nDONE: ${fetched} unique PDFs extracted, ${dupes} content-dupes skipped, ${withAxle} with front+rear axle.`,
  );
  progress(`verdicts: ${JSON.stringify(counts)}`);
  progress(`results → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
