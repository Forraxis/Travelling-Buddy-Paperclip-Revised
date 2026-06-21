/**
 * Brave dork search → deduped PDF candidate list. [axle/spec discovery — wide net]
 *
 * The discovery half of the "google-dork → pipeline" idea, using the Brave Web Search
 * API instead of scraping Google (which CAPTCHA-bans automation). For each vehicle ×
 * dork template it runs one Brave query, collects result URLs, keeps the PDFs, and
 * dedups across all queries → a clean candidate list for the extract pipeline.
 *
 * Dorks are GENERATION-level (not per-year): a spec sheet/manual covers a whole gen,
 * so per-year queries just re-surface the same PDF and burn quota. Precision lives in
 * the intent terms (filetype:pdf + weight keywords), and the year/variant mapping is
 * done downstream by the GVM-validation gate + gen-aware landing.
 *
 * Free/cheap: Brave free tier = 2,000 queries/month, ~1 query/sec (we pace at 1.2s).
 * This job ONLY searches (no downloads) — fetching + extracting the PDFs is the next
 * step (reuse the manual-extract pipeline). Output → ops/n8n/.brave-pdfs.jsonl.
 *
 * Usage:
 *   BRAVE_API_KEY=… npx tsx src/jobs/brave-pdf-search-local.ts
 *   …--vehicles="nissan navara d40,mitsubishi triton,volkswagen amarok"
 *   …--max-queries=20      # hard cap on Brave calls (quota guard)
 */
import { appendFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const VEHICLES = (
  args.find((a) => a.startsWith('--vehicles='))?.slice('--vehicles='.length) ??
  'nissan navara d40,mitsubishi triton,volkswagen amarok'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_QUERIES = Number(
  args
    .find((a) => a.startsWith('--max-queries='))
    ?.slice('--max-queries='.length) ?? '24',
);
const OUT = 'ops/n8n/.brave-pdfs.jsonl';
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/** Generation-level dork templates — `{v}` = "make model gen". Intent terms (filetype
 * + weight keywords) do the filtering; year precision is handled downstream. */
const DORKS = [
  '{v} filetype:pdf gvm gcm specifications',
  '{v} filetype:pdf "gross vehicle mass" axle',
  '{v} owners manual filetype:pdf weights specifications',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hit {
  vehicle: string;
  dork: string;
  url: string;
  title: string;
}

async function braveSearch(
  key: string,
  q: string,
): Promise<{ url: string; title: string }[]> {
  const r = await fetch(
    `${ENDPOINT}?q=${encodeURIComponent(q)}&count=20&country=AU`,
    {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!r.ok) throw new Error(`brave http ${r.status}`);
  const j = (await r.json()) as {
    web?: { results?: { url?: string; title?: string }[] };
  };
  return (j.web?.results ?? [])
    .filter((x) => typeof x.url === 'string')
    .map((x) => ({ url: x.url!, title: x.title ?? '' }));
}

/** Is the URL a PDF? (ends in .pdf, or .pdf before a query string) */
function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}

/** Normalise for dedup: drop query string + trailing slash, lowercase host. */
function normUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase();
  }
}

async function main() {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY is required.');

  writeFileSync(OUT, '');
  console.log(
    `\n=== BRAVE DORK SEARCH · ${VEHICLES.length} vehicles × ${DORKS.length} dorks ===\n`,
  );

  const seen = new Set<string>();
  const hits: Hit[] = [];
  let queries = 0;
  outer: for (const v of VEHICLES) {
    let vehiclePdfs = 0;
    for (const tmpl of DORKS) {
      if (queries >= MAX_QUERIES) {
        console.log(`\n⚠ hit --max-queries=${MAX_QUERIES} cap; stopping.`);
        break outer;
      }
      const dork = tmpl.replace('{v}', v);
      queries += 1;
      let results: { url: string; title: string }[] = [];
      try {
        results = await braveSearch(key, dork);
      } catch (e) {
        console.log(`  [${v}] "${dork}" → ERROR ${(e as Error).message}`);
        await sleep(1200);
        continue;
      }
      const pdfs = results.filter((x) => isPdfUrl(x.url));
      let newCount = 0;
      for (const p of pdfs) {
        const k = normUrl(p.url);
        if (seen.has(k)) continue;
        seen.add(k);
        const hit: Hit = { vehicle: v, dork, url: p.url, title: p.title };
        hits.push(hit);
        appendFileSync(OUT, JSON.stringify(hit) + '\n');
        newCount += 1;
        vehiclePdfs += 1;
      }
      console.log(
        `  [${v}] "${tmpl.replace('{v}', '…')}" → ${results.length} results, ${pdfs.length} pdf, ${newCount} new`,
      );
      await sleep(1200); // ~1 query/sec free-tier pacing
    }
    console.log(`  → ${v}: ${vehiclePdfs} unique PDFs\n`);
  }

  console.log(
    `\n${queries} queries · ${hits.length} unique candidate PDFs → ${OUT}`,
  );
  // Domain breakdown — where are the PDFs coming from?
  const byHost = new Map<string, number>();
  for (const h of hits) {
    try {
      const host = new URL(h.url).host.replace(/^www\./, '');
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    } catch {
      /* skip */
    }
  }
  console.log('top domains:');
  for (const [host, n] of [...byHost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12))
    console.log(`  ${n.toString().padStart(3)}  ${host}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
