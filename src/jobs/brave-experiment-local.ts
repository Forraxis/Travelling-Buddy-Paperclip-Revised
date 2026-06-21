/**
 * Overnight SEARCH EXPERIMENTS — try genuinely different angles for factory axle data.
 * Discovery + report only; lands NOTHING (separate scratch files, reviewed in the morning).
 *
 * Three angles, each different from the main generic-dork pass:
 *   A. SOURCE-MINING — `site:<domain> filetype:pdf` over known AU suspension / GVM-upgrade
 *      vendors. They publish FACTORY axle ratings to sell upgrades (the Lovells pattern);
 *      ultimatesuspension.com.au alone keeps yielding clean F/R values. One site: query
 *      can surface a vendor's whole vehicle library.
 *   B. GAWR TERMINOLOGY — the stubborn passenger-SUVs (RAV4, CX-5…) don't print "axle" in
 *      AU brochures, but technical/global docs use "GAWR" (Gross Axle Weight Rating). Try it.
 *   C. GVM-CERT — `{v} GVM upgrade certificate front rear axle kg` — engineering certs that
 *      tabulate the factory baseline before the upgraded figure.
 *
 * Output: ops/n8n/.experiment-extracted.jsonl (per-PDF specs) + a human report on stdout/log.
 *
 * Usage:
 *   BRAVE_API_KEY=… DATABASE_URL=… npx tsx src/jobs/brave-experiment-local.ts --max-queries=200
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extractManualSpecs } from '../lib/spec-fetch/manual/extract';

const args = process.argv.slice(2);
const MAX_QUERIES = Number(
  args
    .find((a) => a.startsWith('--max-queries='))
    ?.slice('--max-queries='.length) ?? '200',
);
const OUT = 'ops/n8n/.experiment-extracted.jsonl';
const CANDS = 'ops/n8n/.experiment-pdfs.jsonl';
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAXMB = 45;

// ── Angle A: AU suspension / GVM-upgrade vendors that publish factory axle ratings ──
const SUSPENSION_SITES = [
  'ultimatesuspension.com.au',
  'pedders.com.au',
  'peninsula4x4.com.au',
  'ironman4x4.com',
  'dobinsonsprings.com',
  'toughdog.com.au',
  'fulcrumsuspensions.com.au',
  'superiorengineering.com.au',
  'airbagman.com.au',
  'polyair.com.au',
  'drivetech4x4.com.au',
  'lovells.com.au',
  'lovellsadelaide.com.au',
  'tyrant4x4.com.au',
  'powertune4x4.com.au',
];
// ── Angle B: stubborn passenger-SUVs — try the GAWR term + global docs ──
const GAWR_VEHICLES = [
  'toyota rav4',
  'mazda cx-5',
  'mazda cx-3',
  'subaru forester',
  'nissan x-trail',
  'honda cr-v',
  'hyundai tucson',
  'kia sportage',
  'mitsubishi outlander',
  'toyota kluger',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Cand {
  angle: string;
  vehicle: string;
  url: string;
}

async function brave(key: string, q: string): Promise<string[]> {
  const r = await fetch(
    `${ENDPOINT}?q=${encodeURIComponent(q)}&count=20&country=AU`,
    {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!r.ok) throw new Error(`brave http ${r.status}`);
  const j = (await r.json()) as {
    web?: { results?: { url?: string }[] };
  };
  return (j.web?.results ?? [])
    .map((x) => x.url)
    .filter((u): u is string => typeof u === 'string');
}

const isPdf = (u: string) => /\.pdf(\?|#|$)/i.test(u);
function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.host + x.pathname).toLowerCase().replace(/\/$/, '');
  } catch {
    return u.toLowerCase();
  }
}
/** Guess a vehicle label from the PDF filename (HOLDEN-COLORADO-RC.pdf → "holden colorado rc"). */
function nameFromUrl(u: string): string {
  try {
    const file = new URL(u).pathname.split('/').pop() ?? '';
    return decodeURIComponent(file)
      .replace(/\.pdf$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return '';
  }
}

async function fetchPdf(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > MAXMB * 1e6) return null;
    if (Buffer.from(buf.slice(0, 5)).toString('latin1') !== '%PDF-')
      return null;
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY required');

  const seen = new Set<string>();
  const cands: Cand[] = [];
  let queries = 0;
  const log = (m: string) => {
    console.log(m);
    try {
      appendFileSync('ops/n8n/.experiment.log', m + '\n');
    } catch {
      /* ignore */
    }
  };
  writeFileSync(CANDS, '');

  const addHits = async (angle: string, vehicle: string, q: string) => {
    if (queries >= MAX_QUERIES) return;
    queries += 1;
    let urls: string[] = [];
    try {
      urls = await brave(key, q);
    } catch (e) {
      log(`  [${angle}] "${q}" → ERROR ${(e as Error).message}`);
      await sleep(1200);
      return;
    }
    let nu = 0;
    for (const u of urls.filter(isPdf)) {
      const k = normUrl(u);
      if (seen.has(k)) continue;
      seen.add(k);
      const c: Cand = { angle, vehicle, url: u };
      cands.push(c);
      appendFileSync(CANDS, JSON.stringify(c) + '\n');
      nu += 1;
    }
    log(`  [${angle}] "${q}" → ${urls.length} results, ${nu} new pdf`);
    await sleep(1200);
  };

  log(`\n=== EXPERIMENT SEARCH (budget ${MAX_QUERIES} queries) ===`);
  log(`\n-- Angle A: source-mining suspension/GVM-upgrade vendors --`);
  for (const site of SUSPENSION_SITES) {
    await addHits('A-site', site, `site:${site} filetype:pdf gvm`);
    await addHits('A-site', site, `site:${site} filetype:pdf axle`);
  }
  log(`\n-- Angle B: GAWR terminology for stubborn SUVs --`);
  for (const v of GAWR_VEHICLES)
    await addHits('B-gawr', v, `${v} GAWR front rear axle filetype:pdf`);
  log(`\n-- Angle C: GVM-upgrade certificates (factory baseline) --`);
  for (const v of GAWR_VEHICLES)
    await addHits(
      'C-cert',
      v,
      `${v} GVM upgrade certificate front rear axle kg filetype:pdf`,
    );

  log(`\n${queries} Brave queries · ${cands.length} unique candidate PDFs`);

  // ── extract ──
  log(`\n=== EXTRACT ${cands.length} candidates ===`);
  writeFileSync(OUT, '');
  const seenHash = new Set<string>();
  let withAxle = 0;
  const byAngle: Record<string, { n: number; axle: number }> = {};
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    const host = (() => {
      try {
        return new URL(c.url).host.replace(/^www\./, '');
      } catch {
        return '?';
      }
    })();
    const bytes = await fetchPdf(c.url);
    if (!bytes) {
      log(`  ${i + 1}/${cands.length} [${c.angle}] ${host} → skip (fetch)`);
      continue;
    }
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (seenHash.has(hash)) {
      log(`  ${i + 1}/${cands.length} [${c.angle}] ${host} → dup`);
      continue;
    }
    seenHash.add(hash);
    let specs: Record<string, number | null> = {};
    let verdict = 'ERROR';
    try {
      const res = await extractManualSpecs(bytes, {});
      specs = res.specs as unknown as Record<string, number | null>;
      verdict = res.verdict;
    } catch (e) {
      verdict = `ERROR:${(e as Error).message.slice(0, 24)}`;
    }
    const f = specs.frontAxleLimitKg;
    const r = specs.rearAxleLimitKg;
    const hasAxle = f != null && r != null;
    byAngle[c.angle] ??= { n: 0, axle: 0 };
    byAngle[c.angle].n += 1;
    if (hasAxle) {
      withAxle += 1;
      byAngle[c.angle].axle += 1;
    }
    log(
      `  ${i + 1}/${cands.length} [${c.angle}] ${host} → ${verdict}` +
        (hasAxle
          ? `  AXLE ${f}/${r} gvm ${specs.gvmKg ?? '—'}  «${nameFromUrl(c.url)}»`
          : ''),
    );
    appendFileSync(
      OUT,
      JSON.stringify({
        ...c,
        host,
        name: nameFromUrl(c.url),
        verdict,
        specs,
      }) + '\n',
    );
  }

  log(`\n=== EXPERIMENT RESULTS ===`);
  log(`total candidates extracted, ${withAxle} with front+rear axle`);
  for (const [a, s] of Object.entries(byAngle))
    log(`  angle ${a}: ${s.axle}/${s.n} PDFs had axle`);
  log(`results → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
