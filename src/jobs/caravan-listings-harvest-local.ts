/**
 * Caravan ATM/GTM gap-fill from LISTINGS + EDITORIAL REVIEWS via Brave snippets.
 * [task: fill the 100%-null caravan ATM/GTM gap on the Jayco seed]
 *
 * The Jayco web harvest (caravan-jayco-harvest-local.ts) gives us tareKg + tbmKg at
 * 100% but ATM/GTM at 0% — Jayco only publishes those on email-gated, image-only PDFs
 * we can't extract. Recon proved a viable alternative: the ATM / GTM / Tare / Ball
 * figures live IN the Brave search RESULT SNIPPET (the result object's `description`),
 * so we PARSE THE SNIPPET and never fetch the underlying /items or /details pages
 * (caravancampingsales 403s every automated request from here).
 *
 * Sources the snippets come from:
 *   - caravancampingsales.com.au EDITORIAL REVIEWS — carry a structured factory-plate
 *     block: "Nameplate Tare: 2153kg  Nameplate ATM: 2628kg  Ball weight: 138kg"
 *     (internally consistent: ATM − GTM = Ball).
 *   - caravanworld.com.au review tables (Tare / ATM / Ball).
 *   - listing-grid snippets (caravanking, rvboss, …) carrying per-unit
 *     Tare + ATM + GTM + Ball triples keyed by a model code.
 *
 * TARE-ANCHOR TRUST GATE (mandatory — this is what makes a transcribed listing usable):
 * we hold each model's OFFICIAL tare from the seed. We accept a snippet's ATM ONLY when
 * its listed Tare matches the seed tare for that exact model-year/trim within ±15kg. A
 * bigger delta means it's the wrong build year (e.g. a MY25 unit against the MY26 seed)
 * → REJECT. We then DERIVE GTM = adoptedATM − seedTBM (we hold TBM at 100%), and
 * cross-check internal consistency (ATM − GTM ≈ Ball) when a Ball is present.
 *
 * QUALITY TIER: a transcribed listing/review figure is CONFIRMED-grade at best (one tier
 * below a read-the-actual-plate VERIFIED). Emitted candidates are marked CONFIRMED only
 * when they pass the tare gate; everything else is REJECT.
 *
 * NO DATABASE WRITES. NO COMMIT. Candidate JSONL only — ATM/GTM are compliance-critical
 * (Rule 11); a human reviews ops/n8n/.caravan-atm-candidates.jsonl before any load.
 *
 * Free/cheap: Brave free tier = 2,000 q/month, ~1 q/sec (we pace at 1.2s). Snippet-parse
 * only — we never hammer the 403 listing pages. Respect --max-queries (default 80).
 *
 * Usage:
 *   BRAVE_API_KEY=… npx tsx src/jobs/caravan-listings-harvest-local.ts
 *   …--max-queries=80    # hard cap on Brave calls (quota guard)
 *   …--limit=10          # only the first N seed models (cheap smoke test)
 *   …--dorks-per-model=2 # how many of the dork templates to run per model (default 2)
 */
import {
  appendFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';

const args = process.argv.slice(2);
const MAX_QUERIES = Number(
  args
    .find((a) => a.startsWith('--max-queries='))
    ?.slice('--max-queries='.length) ?? '80',
);
const LIMIT = Number(
  args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '999',
);
const DORKS_PER_MODEL = Number(
  args
    .find((a) => a.startsWith('--dorks-per-model='))
    ?.slice('--dorks-per-model='.length) ?? '2',
);

const SEED = 'ops/n8n/.jayco-caravans.jsonl';
const OUT = 'ops/n8n/.caravan-atm-candidates.jsonl';
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
/** Accept a listing's ATM only when its Tare is within ±TARE_TOL kg of the seed tare. */
const TARE_TOL = 15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SeedRow {
  name: string; // floorplan code, e.g. "21.65-3.SL-MY26"
  make: string;
  modelRange: string;
  model: string;
  trim: string;
  yearFrom: number | null;
  tareKg: number | null;
  tbmKg: number | null;
}

interface Candidate {
  modelCode: string; // seed floorplan code we anchored against
  matchedSeedName: string; // == modelCode (the seed row's `name`)
  make: string;
  model: string;
  yearFrom: number | null;
  seedTare: number | null;
  seedTbm: number | null;
  sourceUrl: string;
  sourceHost: string;
  dork: string;
  listedTare: number | null;
  listedAtm: number | null;
  listedGtm: number | null;
  listedBall: number | null;
  tareDelta: number | null; // listedTare − seedTare
  tareMatch: boolean;
  adoptedAtm: number | null; // listedAtm, only when tareMatch
  derivedGtm: number | null; // adoptedAtm − seedTbm
  internalConsistencyOk: boolean | null; // ATM − GTM ≈ Ball (±10kg), null if not testable
  confidence: 'CONFIRMED' | 'REJECT';
  note: string;
  snippet: string;
}

/** Strip HTML tags Brave wraps matched terms in (e.g. <strong>…</strong>). */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "3,395kg" / "3395 kg" / "3395" → 3395; sane caravan-weight range only (300–6000). */
function kg(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[, ]/g, ''), 10);
  return Number.isFinite(n) && n >= 300 && n <= 6000 ? n : null;
}

/**
 * Parse the four weights out of a (tag-stripped) snippet. Robust to:
 *   - "Nameplate ATM: 3395kg" / "Nameplate Tare: 2609 kg" / "Ball weight: 206kg"
 *   - bare "ATM 3,395kg" / "GTM 3189kg" / "Tare 2609kg" / "Ball 206kg"
 *   - partial blocks (only some of the four present).
 * "Nameplate Tare" is matched preferentially; a bare "Tare" still matches.
 */
function parseWeights(text: string): {
  atm: number | null;
  gtm: number | null;
  tare: number | null;
  ball: number | null;
} {
  const t = ` ${text} `;
  // Each field: label (optionally "Nameplate "/"Tow "), optional :/=, number+kg.
  // Require a "kg" unit OR a comma-grouped 4-digit number to avoid grabbing lengths.
  const grab = (labels: string[]): number | null => {
    for (const label of labels) {
      const re = new RegExp(
        `\\b(?:nameplate\\s+|tow\\s*)?${label}\\b[\\s:=]*?(\\d[\\d,]{2,5})\\s*kg`,
        'i',
      );
      const m = t.match(re);
      if (m) {
        const v = kg(m[1]);
        if (v != null) return v;
      }
    }
    return null;
  };
  return {
    atm: grab(['atm', 'aggregate trailer mass']),
    gtm: grab(['gtm', 'gross trailer mass']),
    // "Ball" before "Tare" doesn't matter — distinct labels. "ball weight"/"tow ball".
    ball: grab(['ball\\s*weight', 'ball\\s*mass', 'ball', 'tbm', 'tow\\s*ball']),
    tare: grab(['tare\\s*weight', 'tare\\s*mass', 'tare', 'kerb\\s*weight']),
  };
}

async function braveSearch(
  key: string,
  q: string,
): Promise<{ url: string; title: string; description: string }[]> {
  const r = await fetch(
    `${ENDPOINT}?q=${encodeURIComponent(q)}&count=20&country=AU`,
    {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!r.ok) throw new Error(`brave http ${r.status}`);
  const j = (await r.json()) as {
    web?: {
      results?: { url?: string; title?: string; description?: string }[];
    };
  };
  return (j.web?.results ?? [])
    .filter((x) => typeof x.url === 'string')
    .map((x) => ({
      url: x.url!,
      title: x.title ?? '',
      description: x.description ?? '',
    }));
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Dork templates. `{make}`/`{model}`/`{range}`/`{code}` are filled per seed row. The
 * first templates are the highest-yield (editorial-review nameplate blocks); later ones
 * are broader fallbacks. --dorks-per-model controls how many run per model (quota guard).
 */
const DORK_TEMPLATES: string[] = [
  // 1) caravancampingsales editorial reviews — the structured Nameplate block.
  'site:caravancampingsales.com.au "Nameplate ATM" {make} {range}',
  // 2) caravanworld review tables (Tare/ATM/Ball).
  'site:caravanworld.com.au {make} {range} Tare ATM review',
  // 3) wide net — listing grids keyed by the exact floorplan code.
  '{make} {code} caravan ATM GTM Tare ball',
  // 4) wide net — model-range phrasing (catches units without the code in-snippet).
  '{make} {range} {trim} caravan "ATM" "Tare" "ball weight"',
];

function buildDorks(row: SeedRow): { dork: string; tmpl: string }[] {
  return DORK_TEMPLATES.slice(0, DORKS_PER_MODEL).map((tmpl) => ({
    tmpl,
    dork: tmpl
      .replace(/\{make\}/g, row.make)
      .replace(/\{range\}/g, row.modelRange)
      .replace(/\{model\}/g, row.model)
      .replace(/\{trim\}/g, row.trim)
      .replace(/\{code\}/g, row.name),
  }));
}

/** Load the seed rows we need to anchor against (tare/tbm + identity). */
function loadSeed(): SeedRow[] {
  const out: SeedRow[] = [];
  for (const line of readFileSync(SEED, 'utf8').split('\n').filter(Boolean)) {
    try {
      const d = JSON.parse(line) as Partial<SeedRow>;
      if (!d.name) continue;
      out.push({
        name: d.name,
        make: d.make ?? 'Jayco',
        modelRange: d.modelRange ?? '',
        model: d.model ?? '',
        trim: d.trim ?? '',
        yearFrom: d.yearFrom ?? null,
        tareKg: d.tareKg ?? null,
        tbmKg: d.tbmKg ?? null,
      });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/**
 * Decide whether a parsed snippet is a usable candidate for `row` and build the record.
 * Returns null when the snippet carries no ATM and no Tare (nothing to anchor or adopt).
 */
function buildCandidate(
  row: SeedRow,
  result: { url: string; description: string },
  dork: string,
): Candidate | null {
  const snippet = stripTags(result.description);
  const w = parseWeights(snippet);
  // Need at least an ATM to be useful, and a Tare to anchor on.
  if (w.atm == null && w.tare == null) return null;

  const seedTare = row.tareKg;
  const seedTbm = row.tbmKg;
  const tareDelta =
    w.tare != null && seedTare != null ? w.tare - seedTare : null;
  const tareMatch =
    tareDelta != null && Math.abs(tareDelta) <= TARE_TOL && w.atm != null;

  const adoptedAtm = tareMatch ? w.atm : null;
  const derivedGtm =
    adoptedAtm != null && seedTbm != null ? adoptedAtm - seedTbm : null;

  // Internal consistency: ATM − GTM ≈ Ball (use listed GTM + listed Ball when both present).
  let internalConsistencyOk: boolean | null = null;
  if (w.atm != null && w.gtm != null && w.ball != null) {
    internalConsistencyOk = Math.abs(w.atm - w.gtm - w.ball) <= 10;
  }

  const notes: string[] = [];
  if (w.tare == null) notes.push('no Tare in snippet → cannot anchor');
  else if (seedTare == null) notes.push('seed has no tare → cannot anchor');
  else if (tareMatch)
    notes.push(`tare ${w.tare} matches seed ${seedTare} (Δ${tareDelta})`);
  else
    notes.push(
      `tare ${w.tare} off seed ${seedTare} by ${tareDelta}kg (>±${TARE_TOL}) → likely wrong build year`,
    );
  if (tareMatch && derivedGtm != null)
    notes.push(`derivedGTM=${adoptedAtm}-${seedTbm}=${derivedGtm}`);
  if (internalConsistencyOk === false)
    notes.push(
      `internal check FAIL: ATM-GTM=${w.atm! - w.gtm!} vs ball ${w.ball}`,
    );

  return {
    modelCode: row.name,
    matchedSeedName: row.name,
    make: row.make,
    model: row.model,
    yearFrom: row.yearFrom,
    seedTare,
    seedTbm,
    sourceUrl: result.url,
    sourceHost: host(result.url),
    dork,
    listedTare: w.tare,
    listedAtm: w.atm,
    listedGtm: w.gtm,
    listedBall: w.ball,
    tareDelta,
    tareMatch,
    adoptedAtm,
    derivedGtm,
    internalConsistencyOk,
    confidence: tareMatch ? 'CONFIRMED' : 'REJECT',
    note: notes.join('; '),
    snippet,
  };
}

async function main() {
  const key = process.env.BRAVE_API_KEY;
  if (!key) throw new Error('BRAVE_API_KEY is required.');
  if (!existsSync(SEED)) throw new Error(`seed not found: ${SEED}`);

  const seed = loadSeed().slice(0, LIMIT);
  writeFileSync(OUT, '');
  console.log(
    `\n=== CARAVAN ATM/GTM LISTINGS HARVEST ===\n` +
      `seed models: ${seed.length} · dorks/model: ${DORKS_PER_MODEL} · max-queries: ${MAX_QUERIES}\n` +
      `tare-anchor tol: ±${TARE_TOL}kg · snippet-parse only (no page fetch) → ${OUT}\n`,
  );

  let queries = 0;
  let candidates = 0;
  let adopted = 0;
  let rejected = 0;
  // Track per-seed-row: did ANY candidate pass the tare gate for this code?
  const adoptedByCode = new Map<string, Candidate>();
  // Dedup identical (code, sourceUrl) candidates across dorks.
  const seenPair = new Set<string>();

  outer: for (const row of seed) {
    let rowCandidates = 0;
    let rowAdopted = 0;
    for (const { dork, tmpl } of buildDorks(row)) {
      if (queries >= MAX_QUERIES) {
        console.log(`\n⚠ hit --max-queries=${MAX_QUERIES} cap; stopping.`);
        break outer;
      }
      queries += 1;
      let results: { url: string; title: string; description: string }[] = [];
      try {
        results = await braveSearch(key, dork);
      } catch (e) {
        console.log(`  [${row.name}] "${tmpl}" → ERROR ${(e as Error).message}`);
        await sleep(1200);
        continue;
      }
      let newHere = 0;
      for (const r of results) {
        const cand = buildCandidate(row, r, dork);
        if (!cand) continue;
        const pairKey = `${row.name}|${cand.sourceUrl}`;
        if (seenPair.has(pairKey)) continue;
        seenPair.add(pairKey);
        appendFileSync(OUT, JSON.stringify(cand) + '\n');
        candidates += 1;
        rowCandidates += 1;
        newHere += 1;
        if (cand.tareMatch) {
          adopted += 1;
          rowAdopted += 1;
          // Keep the best (internally-consistent, then first) adopted per code.
          const prev = adoptedByCode.get(row.name);
          if (
            !prev ||
            (cand.internalConsistencyOk === true &&
              prev.internalConsistencyOk !== true)
          )
            adoptedByCode.set(row.name, cand);
        } else {
          rejected += 1;
        }
      }
      console.log(
        `  [${row.name.padEnd(22)}] "${tmpl.slice(0, 38)}…" → ${results.length} res, ${newHere} cand`,
      );
      await sleep(1200); // ~1 q/sec free-tier pacing
    }
    if (rowCandidates > 0)
      console.log(
        `    → ${row.name}: ${rowCandidates} candidates, ${rowAdopted} passed tare gate\n`,
      );
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(64)}`);
  console.log(`SUMMARY`);
  console.log(`  Brave queries used      ${queries}`);
  console.log(`  seed model-codes seen   ${seed.length}`);
  console.log(`  candidates emitted      ${candidates}`);
  console.log(`  PASSED tare gate        ${adopted} (→ adoptable ATM)`);
  console.log(`  REJECTED                ${rejected}`);
  console.log(
    `  seed rows now filled    ${adoptedByCode.size}/63 (≥1 adopted ATM)`,
  );

  if (adoptedByCode.size) {
    console.log(`\nADOPTED (model → ATM / derived-GTM @ matching tare):`);
    for (const [code, c] of [...adoptedByCode.entries()].sort()) {
      console.log(
        `  ${code.padEnd(22)} ATM ${c.adoptedAtm}  GTM ${c.derivedGtm}` +
          `  (tare ${c.listedTare}≈seed ${c.seedTare}, tbm ${c.seedTbm})` +
          `  ${c.internalConsistencyOk === true ? '[consistent]' : ''}  ${c.sourceHost}`,
      );
    }
  }

  // Source-host breakdown of all candidates.
  const byHost = new Map<string, { total: number; adopted: number }>();
  for (const line of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) {
    try {
      const c = JSON.parse(line) as Candidate;
      const e = byHost.get(c.sourceHost) ?? { total: 0, adopted: 0 };
      e.total += 1;
      if (c.tareMatch) e.adopted += 1;
      byHost.set(c.sourceHost, e);
    } catch {
      /* skip */
    }
  }
  console.log(`\nby source host (total / adopted):`);
  for (const [h, e] of [...byHost.entries()].sort(
    (a, b) => b[1].total - a[1].total,
  ))
    console.log(`  ${String(e.total).padStart(3)} / ${e.adopted}  ${h}`);

  console.log(`\ncandidates → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
