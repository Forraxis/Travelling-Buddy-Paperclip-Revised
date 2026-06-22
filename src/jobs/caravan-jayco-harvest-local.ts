/**
 * Jayco Australia caravan/towable spec harvest — the caravan-catalogue spine.
 * [task: source caravan floorplan specs]
 *
 * Jayco's site (jayco.com.au) is a JS-rendered Next.js app, but the per-floorplan
 * spec data is served cleanly as structured JSON from the Next.js data endpoint:
 *   https://www.jayco.com.au/_next/data/<buildId>/range/<category>/<slug>.json
 * That JSON is the canonical, server-authoritative source (no anti-bot, no headless
 * browser, no PDF OCR needed). Recon confirmed the email-gated spec PDFs (which carry
 * ATM/GTM) are robots-disallowed and 10MB+ image PDFs we can't extract here, and the
 * third-party aggregators that DO list ATM are MY-mismatched against the official
 * tare/ball — so this job harvests ONLY the official web payload and leaves ATM/GTM
 * null (the single biggest, honestly-flagged gap) rather than merging noisy figures.
 *
 * Per floorplan we lift, deterministically (no AI / no VLM — the data is structured):
 *   - name/code (e.g. "21.65-3.SL-MY26"), trim (Touring/Outback/…), model + range
 *   - tareKg, tbmKg (Towball), bodyLengthMm, overallLengthMm (Travel length)
 *   - interiorHeightMm / travelHeightMm (raw, for later use; 0 → null)
 *   - freshWaterCapacityL, greyWaterCapacityL(presence), gasBottleConfig — parsed
 *     from the per-floorplan "standard/optional" feature rows (the modal `values`
 *     column is indexed by floorplanId, so each floorplan gets ITS OWN config)
 *   - axleConfiguration — inferred from the "(Tandem Only)" braking inclusion +
 *     coupling text (heuristic, flagged low-confidence)
 *   - yearFrom — parsed from the MY tag in the code ("MY26" → 2026)
 *   - bodyType — mapped from the range category + pop-top/hybrid/camper cues
 *
 * NO DATABASE WRITES. Pure dataset: writes one JSONL record per floorplan to
 * ops/n8n/.jayco-caravans.jsonl for human review before any catalogue load.
 *
 * Usage:
 *   npx tsx src/jobs/caravan-jayco-harvest-local.ts            # full harvest
 *   npx tsx src/jobs/caravan-jayco-harvest-local.ts --limit=3  # first N models (test)
 */
import { writeFileSync, appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const LIMIT = Number(
  args.find((a) => a.startsWith('--limit='))?.slice('--limit='.length) ?? '999',
);
const OUT = 'ops/n8n/.jayco-caravans.jsonl';
const PROGRESS = 'ops/n8n/.jayco-harvest.log';
const BASE = 'https://www.jayco.com.au';
const SITEMAP = `${BASE}/sitemap.xml`;
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Towable range categories worth harvesting (caravans, campers, hybrids, pop-tops,
 * j-pods, toy-haulers). Motorised lines (campervans, motorhomes) are NOT towables and
 * are deliberately excluded from the caravan catalogue.
 */
const TOWABLE_CATEGORIES = new Set([
  'caravans',
  'camper-trailers',
  'jayco-hybrids',
  'jayco-j-pod',
  'pop-tops',
  'toy-haulers',
  'off-grid',
]);

function progress(msg: string): void {
  try {
    appendFileSync(PROGRESS, `${new Date().toISOString()}  ${msg}\n`);
  } catch {
    /* ignore */
  }
  console.log(msg);
}

async function getRaw(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.text();
}

/** Politeness pause between model fetches. */
function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** A spec value string → integer, treating Jayco's "0" placeholder as null. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "MY26" / "MY-26" in a floorplan code → 2026. */
function yearFromCode(code: string): number | null {
  const m = code.match(/MY[-\s]?(\d{2})/i);
  if (!m) return null;
  return 2000 + parseInt(m[1], 10);
}

/**
 * Parse fresh-water litres from a feature title like "Fresh water tanks - 2 x 95L"
 * → 190, or "1 x 82L" → 82. Returns null if no L figure.
 */
function parseWaterLitres(title: string): number | null {
  // "2 x 95L" / "2x95 L" / "95L"
  const mult = title.match(/(\d+)\s*[x×]\s*(\d{2,3})\s*l\b/i);
  if (mult) return parseInt(mult[1], 10) * parseInt(mult[2], 10);
  const single = title.match(/(\d{2,3})\s*l\b/i);
  if (single) return parseInt(single[1], 10);
  return null;
}

/** Gas config like "Gas bottles - 2 x 9kg" → "2 x 9kg". */
function parseGasConfig(title: string): string | null {
  const m = title.match(/(\d+\s*[x×]\s*\d+\s*kg)/i);
  return m ? m[1].replace(/\s*[x×]\s*/i, ' x ').replace(/\s+/g, ' ').trim() : null;
}

type CaravanBodyType =
  | 'CARAVAN_POP_TOP'
  | 'CARAVAN_FULL_HEIGHT'
  | 'OFF_ROAD_CARAVAN'
  | 'CAMPER_TRAILER'
  | 'HYBRID'
  | 'OTHER';

/**
 * Map a (category, slug, trim) tuple to the catalogue bodyType enum. Outback trims of
 * full-height vans read as off-road; pop-top categories/slugs → pop-top; campers and
 * j-pods are camper-trailers / hybrids.
 */
function bodyTypeFor(
  category: string,
  slug: string,
  trim: string,
): CaravanBodyType {
  const s = `${slug} ${trim}`.toLowerCase();
  if (category === 'camper-trailers') return 'CAMPER_TRAILER';
  if (category === 'jayco-hybrids' || /hybrid/.test(s)) return 'HYBRID';
  if (category === 'jayco-j-pod' || /j-pod|jpod/.test(s)) return 'HYBRID';
  if (category === 'pop-tops' || /pop-top|pop top/.test(s))
    return 'CARAVAN_POP_TOP';
  if (category === 'toy-haulers') return 'OFF_ROAD_CARAVAN';
  // caravans / off-grid: Outback (or off-grid) trims read as off-road.
  if (category === 'off-grid' || /outback|off-grid|off grid/.test(s))
    return 'OFF_ROAD_CARAVAN';
  return 'CARAVAN_FULL_HEIGHT';
}

type AxleConfiguration =
  | 'SINGLE_AXLE'
  | 'DUAL_AXLE_CLOSE_COUPLED'
  | 'DUAL_AXLE_SPREAD'
  | 'TRIPLE_AXLE'
  | null;

interface FeatureFlag {
  /** the feature row title */
  title: string;
  /** 'standard' | 'optional' | 'na' — for THIS floorplan's modal column */
  value: string;
}

/**
 * Infer single vs tandem from feature cues. Jayco lists "Anti-Lock Electric braking
 * system (Tandem Only)" as standard on tandem vans; small campers/j-pods omit it and
 * are single-axle. Heuristic — flagged low-confidence in the record.
 */
function inferAxle(
  flags: FeatureFlag[],
  tareKg: number | null,
): { axleConfiguration: AxleConfiguration; axleConfidence: string } {
  const std = flags.filter((f) => f.value === 'standard');
  const tandemSignal = std.some((f) => /tandem/i.test(f.title));
  const singleSignal = std.some((f) => /single\s*axle/i.test(f.title));
  if (tandemSignal && !singleSignal)
    return {
      axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
      axleConfidence: 'inferred:tandem-feature',
    };
  if (singleSignal)
    return {
      axleConfiguration: 'SINGLE_AXLE',
      axleConfidence: 'inferred:single-feature',
    };
  // Fallback by tare: small towables (< ~1500kg) are typically single-axle.
  if (tareKg != null && tareKg < 1500)
    return {
      axleConfiguration: 'SINGLE_AXLE',
      axleConfidence: 'guess:tare<1500',
    };
  if (tareKg != null && tareKg >= 1500)
    return {
      axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
      axleConfidence: 'guess:tare>=1500',
    };
  return { axleConfiguration: null, axleConfidence: 'unknown' };
}

interface SpecRow {
  title: string;
  value: string;
}
interface ModalModel {
  series?: string;
  model?: string;
  id?: string | number;
}
interface ModalFeature {
  title: string;
  values?: string[];
}
interface ModalSection {
  title: string;
  features?: ModalFeature[];
}
interface FloorplanNode {
  title?: string;
  floorplanId?: string | number;
  brand?: string;
  price?: unknown;
  specsFeatures?: {
    specs?: SpecRow[];
    modal?: { models?: ModalModel[]; sections?: ModalSection[] };
  };
}
interface ModelNode {
  name?: string; // the trim, e.g. "Touring" / "Outback"
  floorplans?: { floorplan?: FloorplanNode }[];
}

interface JaycoRecord {
  source: string;
  sourceUrl: string;
  make: string;
  modelRange: string; // e.g. "Silverline"
  model: string; // catalogue CaravanModel.name (range + trim, e.g. "Silverline Outback")
  trim: string; // "Touring" / "Outback" / "Adventurer" / "JPod-X"
  bodyType: CaravanBodyType;
  name: string; // CaravanVariant.name (floorplan code, e.g. "21.65-3.SL-MY26")
  floorplanId: string | null;
  yearFrom: number | null;
  // weights (kg)
  atmKg: number | null; // always null — absent from Jayco web (gated PDF only)
  gtmKg: number | null; // always null — absent from Jayco web
  tareKg: number | null;
  tbmKg: number | null;
  // axle (geometry deferred → coupling/spacing left null by design)
  axleConfiguration: AxleConfiguration;
  axleConfidence: string;
  couplingToAxleMm: null;
  axleSpacingMm: null;
  // dimensions (mm)
  bodyLengthMm: number | null;
  overallLengthMm: number | null;
  interiorHeightMm: number | null; // raw extra, not a catalogue field
  travelHeightMm: number | null; // raw extra
  // tanks / gas
  freshWaterCapacityL: number | null;
  freshWaterOptionalL: number | null; // optional upgrade tank, if listed
  greyWaterCapacityL: number | null; // litres absent on web → presence-only → null
  greyWaterPresent: boolean;
  gasBottleConfig: string | null;
  // raw rows kept verbatim for human review / later derivation
  raw: {
    couplingText: string | null;
    waterFeatures: string[];
    gasFeatures: string[];
    brakingFeatures: string[];
    specs: SpecRow[];
  };
}

/** Walk a model payload's floorplans into flat records. */
function recordsFromPayload(
  payload: unknown,
  category: string,
  slug: string,
  sourceUrl: string,
): JaycoRecord[] {
  const pp = (payload as { pageProps?: { cbData?: unknown[] } }).pageProps;
  const cb = (pp?.cbData ?? []).find(
    (c): c is { data: { models: ModelNode[] } } =>
      !!c &&
      typeof c === 'object' &&
      !!(c as { data?: { models?: unknown } }).data?.models,
  );
  if (!cb) return [];

  const out: JaycoRecord[] = [];
  for (const m of cb.data.models) {
    const trim = (m.name ?? '').trim() || 'Standard';
    for (const f of m.floorplans ?? []) {
      const fp = f.floorplan;
      if (!fp || !fp.title) continue;
      const code = fp.title.trim();
      const specs = fp.specsFeatures?.specs ?? [];
      const specMap = new Map<string, string>();
      for (const s of specs) specMap.set(s.title.toLowerCase(), s.value);
      const tareKg = num(specMap.get('tare weight (kg)'));
      const tbmKg = num(specMap.get('towball weight (kg)'));
      const bodyLengthMm = num(specMap.get('body length (mm)'));
      const overallLengthMm = num(specMap.get('travel length (mm)'));
      const interiorHeightMm = num(specMap.get('interior height (mm)'));
      const travelHeightMm = num(specMap.get('travel height (mm)'));

      // Locate THIS floorplan's column in the shared modal (values are indexed by
      // floorplanId across the model's trims).
      const modal = fp.specsFeatures?.modal;
      const cols = modal?.models ?? [];
      const colIdx = cols.findIndex(
        (c) => String(c.id) === String(fp.floorplanId),
      );
      const idx = colIdx >= 0 ? colIdx : 0;

      const flags: FeatureFlag[] = [];
      const waterFeatures: string[] = [];
      const gasFeatures: string[] = [];
      const brakingFeatures: string[] = [];
      let couplingText: string | null = null;
      let freshStd: number | null = null;
      let freshOpt: number | null = null;
      let greyPresent = false;
      let gasConfig: string | null = null;

      for (const section of modal?.sections ?? []) {
        for (const feat of section.features ?? []) {
          const val = (feat.values?.[idx] ?? '').toLowerCase();
          flags.push({ title: feat.title, value: val });
          const t = feat.title;
          if (val === 'na') continue; // not on this floorplan
          if (/coupling/i.test(t)) couplingText = couplingText ?? t;
          if (/brak|tandem|single\s*axle/i.test(t)) brakingFeatures.push(t);
          if (/fresh water|water tank/i.test(t)) {
            waterFeatures.push(`${t} [${val}]`);
            const litres = parseWaterLitres(t);
            if (litres != null) {
              if (val === 'standard' && freshStd == null) freshStd = litres;
              else if (val === 'optional' && freshOpt == null)
                freshOpt = litres;
            }
          }
          if (/grey water/i.test(t)) greyPresent = true;
          if (/gas bottle/i.test(t)) {
            gasFeatures.push(`${t} [${val}]`);
            const g = parseGasConfig(t);
            if (g && val === 'standard' && gasConfig == null) gasConfig = g;
            else if (g && gasConfig == null) gasConfig = g;
          }
        }
      }

      const { axleConfiguration, axleConfidence } = inferAxle(flags, tareKg);
      // Derive a human range label from the slug (strip jayco-, -caravan, etc.).
      const rangeLabel = slugToRange(slug);
      // CaravanModel.name = range + trim, but drop the trim when it just restates
      // the range (e.g. J-Pod's trim "JPod-X" vs range "J Pod X") to avoid noise.
      const trimNorm = trim.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rangeNorm = rangeLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const modelName = rangeNorm.includes(trimNorm)
        ? rangeLabel
        : `${rangeLabel} ${trim}`.replace(/\s+/g, ' ').trim();

      out.push({
        source: 'jayco.com.au _next/data',
        sourceUrl,
        make: 'Jayco',
        modelRange: rangeLabel,
        model: modelName,
        trim,
        bodyType: bodyTypeFor(category, slug, trim),
        name: code,
        floorplanId: fp.floorplanId != null ? String(fp.floorplanId) : null,
        yearFrom: yearFromCode(code),
        atmKg: null,
        gtmKg: null,
        tareKg,
        tbmKg,
        axleConfiguration,
        axleConfidence,
        couplingToAxleMm: null,
        axleSpacingMm: null,
        bodyLengthMm,
        overallLengthMm,
        interiorHeightMm,
        travelHeightMm,
        freshWaterCapacityL: freshStd,
        freshWaterOptionalL: freshOpt,
        greyWaterCapacityL: null,
        greyWaterPresent: greyPresent,
        gasBottleConfig: gasConfig,
        raw: {
          couplingText,
          waterFeatures,
          gasFeatures,
          brakingFeatures,
          specs,
        },
      });
    }
  }
  return out;
}

/** Slug → a clean range/series label, e.g. "jayco-silverline-caravan" → "Silverline". */
function slugToRange(slug: string): string {
  return slug
    .replace(/^jayco-/, '')
    .replace(/-caravan(-48v)?$/, (m) => (m.includes('48v') ? ' 48V' : ''))
    .replace(/-pop-top$/, ' Pop Top')
    .replace(/-hybrid(-caravan|-pop-top)?$/, ' Hybrid')
    .replace(/-camper-trailer$/, '')
    .replace(/-toy-hauler$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/48v/i, '48V')
    .replace(/Jrv/i, 'JRV')
    .replace(/Jpod/i, 'J-Pod')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  writeFileSync(PROGRESS, '');
  progress(`\n=== JAYCO CARAVAN HARVEST ===`);

  // 1) Enumerate towable model pages from the sitemap.
  const sitemap = await getRaw(SITEMAP);
  const allPaths = [
    ...new Set(
      [...sitemap.matchAll(/range\/([a-z0-9-]+)\/([a-z0-9-]+)/g)].map(
        (m) => `${m[1]}/${m[2]}`,
      ),
    ),
  ];
  // Keep only towable categories; drop the catch-all "new-models/new-models" page.
  const models = allPaths
    .map((p) => {
      const [category, slug] = p.split('/');
      return { category, slug, path: p };
    })
    .filter(
      (m) =>
        TOWABLE_CATEGORIES.has(m.category) &&
        m.slug !== 'new-models' &&
        m.slug !== m.category,
    );
  progress(
    `sitemap: ${allPaths.length} range pages, ${models.length} towable model pages selected`,
  );

  // 2) Fresh buildId (it rotates on each deploy) — read from any model page's HTML.
  const sampleHtml = await getRaw(`${BASE}/range/${models[0].path}`);
  const buildId = sampleHtml.match(/"buildId":"([^"]+)"/)?.[1];
  if (!buildId) throw new Error('could not read buildId from page HTML');
  progress(`buildId: ${buildId}`);

  // 3) Fetch each model's _next/data JSON and flatten floorplans.
  writeFileSync(OUT, '');
  const targets = models.slice(0, LIMIT);
  const all: JaycoRecord[] = [];
  const seenSlug = new Set<string>(); // off-grid duplicates the caravan/hybrid slugs
  for (let i = 0; i < targets.length; i++) {
    const { category, slug, path } = targets[i];
    if (seenSlug.has(slug)) {
      progress(`  ${i + 1}/${targets.length} ${path} → dup slug, skip`);
      continue;
    }
    const url = `${BASE}/_next/data/${buildId}/range/${path}.json`;
    try {
      const payload = JSON.parse(await getRaw(url));
      const recs = recordsFromPayload(
        payload,
        category,
        slug,
        `${BASE}/range/${path}`,
      );
      for (const r of recs) appendFileSync(OUT, JSON.stringify(r) + '\n');
      all.push(...recs);
      seenSlug.add(slug);
      const trims = [...new Set(recs.map((r) => r.trim))].join(',');
      progress(
        `  ${i + 1}/${targets.length} ${slug.padEnd(34)} → ${recs.length} floorplans [${trims}]`,
      );
    } catch (e) {
      progress(`  ${i + 1}/${targets.length} ${slug} → ERROR ${(e as Error).message}`);
    }
    await sleep(700); // pace politely
  }

  // 4) Coverage report.
  const N = all.length;
  const pct = (n: number) => (N ? `${Math.round((n / N) * 100)}%` : '0%');
  const cov = (pred: (r: JaycoRecord) => boolean) =>
    pct(all.filter(pred).length);
  const modelCount = new Set(all.map((r) => r.model)).size;
  progress(
    `\nHARVESTED: ${N} floorplans across ${modelCount} models (${seenSlug.size} ranges).`,
  );
  progress(`coverage:`);
  progress(`  tareKg              ${cov((r) => r.tareKg != null)}`);
  progress(`  tbmKg               ${cov((r) => r.tbmKg != null)}`);
  progress(`  bodyLengthMm        ${cov((r) => r.bodyLengthMm != null)}`);
  progress(`  overallLengthMm     ${cov((r) => r.overallLengthMm != null)}`);
  progress(
    `  axleConfiguration   ${cov((r) => r.axleConfiguration != null)} (inferred/guess)`,
  );
  progress(
    `  freshWaterCapacityL ${cov((r) => r.freshWaterCapacityL != null)}`,
  );
  progress(`  greyWaterPresent    ${cov((r) => r.greyWaterPresent)}`);
  progress(`  gasBottleConfig     ${cov((r) => r.gasBottleConfig != null)}`);
  progress(`  yearFrom            ${cov((r) => r.yearFrom != null)}`);
  progress(`  atmKg / gtmKg       0% (absent from Jayco web — gated PDF only)`);
  progress(`\ndataset → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
