/**
 * Local manual / spec-document extraction core. [task: manual sourcing — step 1]
 *
 * Pure-local, FREE, no egress: a PDF (owner's manual, spec sheet, RVD…) → the
 * weights figures, validated against what we already know. The expensive cloud
 * (Claude web_search) is NOT used here — this is the free-server half of the
 * pipeline that the orchestrator offloads onto:
 *
 *   PDF bytes
 *     → PRE-SCREEN the text layer                (free gate: weight-rating terms?
 *                                                 none → NO_WEIGHTS, stop — it's a
 *                                                 workshop/repair manual or brochure)
 *     → locate the weights/axle page(s)         (unpdf text layer — free)
 *     → text-first, else render → docling VLM   (.150:8085, only for scanned pages)
 *     → Qwen (.150:8082, thinking off)          (table text → spec JSON)
 *     → merge across pages, then VALIDATE:       extracted GVM/GCM vs our known
 *                                                figures + axle plausibility
 *     → verdict  (CONFIRMED / REVIEW / NO_AXLE / REJECT / NO_WEIGHTS / EMPTY)
 *
 * The verdict is what the loop acts on: CONFIRMED → store + next vehicle; REJECT
 * (GVM disagrees → wrong doc) → try another source; NO_AXLE → right doc, no axles,
 * move on; NO_WEIGHTS → wrong doc type, skipped for free. Endpoints are
 * env-overridable so tests can point at a stub.
 */
import { renderPageAsImage, getDocumentProxy, extractText } from 'unpdf';

const DOCLING_URL = process.env.DOCLING_BASE_URL ?? 'http://172.16.45.150:8085';
const QWEN_URL = process.env.QWEN_BASE_URL ?? 'http://172.16.45.150:8082';
const QWEN_MODEL = process.env.QWEN_MODEL ?? 'qwen36-35b-a3b-q4';

/** Spec fields we try to lift off a weights table. */
export interface ManualSpecs {
  gvmKg: number | null;
  gcmKg: number | null;
  kerbWeightKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingCapacityKg: number | null;
  maxTowBallDownloadKg: number | null;
  // Dimensions (mm) — wheelbase/length fill catalogue gaps; the overhang split
  // feeds the longitudinal-CoG beam model (the differentiator). Best-effort: spec
  // sheets table these alongside weights; owner's manuals often page them separately.
  wheelbaseMm: number | null;
  frontOverhangMm: number | null;
  rearOverhangMm: number | null;
  totalLengthMm: number | null;
}

export type Verdict =
  | 'CONFIRMED'
  | 'REVIEW'
  | 'NO_AXLE'
  | 'REJECT'
  | 'EMPTY'
  | 'NO_WEIGHTS';

export interface KnownSpecs {
  gvmKg?: number | null;
  gcmKg?: number | null;
}

export interface ExtractResult {
  specs: ManualSpecs;
  pagesUsed: number[];
  prescreen: {
    /** false = a substantial text layer with no weights-rating terms → wrong doc
     * type (workshop/repair manual, brochure …); extraction was skipped. */
    hasWeightData: boolean;
    /** the weight-rating phrases that matched (for transparency). */
    signals: string[];
    /** true when the text layer is too thin to judge (likely scanned) → we let the
     * VLM try rather than reject. */
    scannedFallback: boolean;
  };
  validation: {
    gvmMatch: boolean | null; // null = couldn't compare (a side missing)
    gcmMatch: boolean | null;
    axlesPresent: boolean;
    axlePlausible: boolean;
  };
  verdict: Verdict;
}

/** Strong weight-RATING phrases. A real weights/specifications page has at least
 * one; a workshop/repair manual (which says "axle" constantly in a mechanical
 * sense) has none — that's the discriminator. Deliberately excludes a bare "axle"
 * and a bare "axle weight" (matched a jacking instruction in the D40 manual). */
const WEIGHT_SIGNALS: { label: string; re: RegExp }[] = [
  { label: 'gross vehicle mass/weight', re: /gross vehicle (mass|weight)/i },
  { label: 'GVM', re: /\bgvm\b/i },
  { label: 'GVW(R)', re: /\bgvwr?\b/i },
  { label: 'gross combination', re: /gross combination (mass|weight)/i },
  { label: 'GCM/GCWR', re: /\bgc[mw]r?\b/i },
  { label: 'gross axle weight/GAWR', re: /gross axle weight|\bgawr\b/i },
  { label: 'permissible axle', re: /permissible\s+(front|rear)?\s*axle/i },
  {
    label: 'max axle load/weight',
    re: /(maximum|max\.?)\s+axle\s+(load|weight|mass)/i,
  },
  {
    label: 'front/rear axle capacity',
    re: /(front|rear)\s+axle\s+(capacity|rating|load)/i,
  },
  { label: 'kerb/curb weight', re: /(kerb|curb)\s+(weight|mass)/i },
];

/** Free pre-screen: does this PDF's text layer carry weight-RATING data? Returns
 * what matched + whether the doc is too text-thin to judge (scanned → let VLM try). */
function prescreen(fullText: string): {
  hasWeightData: boolean;
  signals: string[];
  scannedFallback: boolean;
} {
  const trimmedLen = fullText.replace(/\s+/g, ' ').trim().length;
  const signals = WEIGHT_SIGNALS.filter((s) => s.re.test(fullText)).map(
    (s) => s.label,
  );
  // A doc with a real text layer (≥2k chars) and no weight-rating phrase is the
  // wrong document. Too-thin text = likely scanned → don't reject; let the VLM run.
  const scannedFallback = trimmedLen < 2000;
  return {
    hasWeightData: signals.length > 0 || scannedFallback,
    signals,
    scannedFallback,
  };
}

const SPEC_KEYS: (keyof ManualSpecs)[] = [
  'gvmKg',
  'gcmKg',
  'kerbWeightKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'maxTowingCapacityKg',
  'maxTowBallDownloadKg',
  'wheelbaseMm',
  'frontOverhangMm',
  'rearOverhangMm',
  'totalLengthMm',
];

/** Score a page by how likely it holds the weights/axle table. */
function weightsScore(pageText: string): number {
  const t = pageText.toLowerCase();
  let s = 0;
  if (/\baxle\b/.test(t)) s += 3;
  if (/gross vehicle mass|\bgvm\b/.test(t)) s += 2;
  if (/gross combination mass|\bgcm\b|\bgcwr\b/.test(t)) s += 2;
  if (/kerb|tare/.test(t)) s += 1;
  if (/towing|tow ball|tow bar|gtm|atm/.test(t)) s += 1;
  if (/weights?\b|loading|payload/.test(t)) s += 1;
  return s;
}

/** Extract the text layer per page (1-based index = position+1). */
async function extractPerPageText(data: Uint8Array): Promise<string[]> {
  // pdf.js transfers (detaches) the buffer it's given — clone so the caller's
  // pristine copy survives for the later page renders.
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]) as string[];
}

/** Pick the most weights-relevant pages from already-extracted page text. */
function pickWeightsPages(
  pages: string[],
  maxPages: number,
): { page: number; text: string }[] {
  return pages
    .map((t, i) => ({ page: i + 1, text: t, score: weightsScore(t) }))
    .filter((p) => p.score >= 3) // must at least mention an axle/GVM
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map((p) => ({ page: p.page, text: p.text }));
}

async function renderPng(data: Uint8Array, page: number): Promise<string> {
  // Clone per render — pdf.js detaches the buffer it receives.
  const img = await renderPageAsImage(new Uint8Array(data), page, {
    scale: 2.5,
    canvasImport: () => import('@napi-rs/canvas'),
  });
  return Buffer.from(img).toString('base64');
}

/** granite-docling: page image → structured table/text. Tries the table-oriented
 * prompt first (best for weights tables); falls back to whole-page conversion when
 * the table prompt comes back near-empty (free-text pages). */
async function docling(b64: string): Promise<string> {
  const ask = async (prompt: string): Promise<string> => {
    const r = await fetch(`${DOCLING_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'granite-docling',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${b64}` },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0,
      }),
    });
    const j = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return j.choices?.[0]?.message?.content ?? '';
  };
  const otsl = await ask('Convert this table to OTSL.');
  // strip <loc_...> coordinate tags to judge real content length
  const body = otsl.replace(/<loc_\d+>/g, '').trim();
  if (body.length >= 40) return otsl;
  return await ask('Convert this page to docling.');
}

/** Qwen (thinking off): document text → spec JSON. */
async function qwenExtract(docText: string): Promise<Partial<ManualSpecs>> {
  const sys =
    'You extract vehicle specifications from document text into JSON. Weight keys (integer kg): ' +
    'gvmKg, gcmKg, kerbWeightKg, frontAxleLimitKg, rearAxleLimitKg, maxTowingCapacityKg, ' +
    'maxTowBallDownloadKg. Front/rear axle = the front/rear axle capacity or GAWR. ' +
    'Dimension keys (integer MILLIMETRES — convert metres ×1000): wheelbaseMm, totalLengthMm ' +
    '(overall length), frontOverhangMm, rearOverhangMm (front/rear overhang — distance from ' +
    'the axle to the body end; only if explicitly stated, do not derive). Use the exact value ' +
    'stated, or null if not present. Return only JSON.';
  const r = await fetch(`${QWEN_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: docText.slice(0, 8000) },
      ],
      max_tokens: 700,
      temperature: 0,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  const j = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = j.choices?.[0]?.message?.content ?? '{}';
  try {
    const obj = JSON.parse(content) as Record<string, unknown>;
    const out: Partial<ManualSpecs> = {};
    for (const k of SPEC_KEYS) {
      const v = obj[k];
      out[k] = typeof v === 'number' ? v : null;
    }
    return out;
  } catch {
    return {};
  }
}

function withinPct(a: number, b: number, pct: number): boolean {
  return Math.abs(a - b) <= (pct / 100) * b;
}

const EMPTY_SPECS: ManualSpecs = {
  gvmKg: null,
  gcmKg: null,
  kerbWeightKg: null,
  frontAxleLimitKg: null,
  rearAxleLimitKg: null,
  maxTowingCapacityKg: null,
  maxTowBallDownloadKg: null,
  wheelbaseMm: null,
  frontOverhangMm: null,
  rearOverhangMm: null,
  totalLengthMm: null,
};

/** Full pipeline: PDF → PRE-SCREEN → weights page(s) → docling/text → Qwen → validate.
 * The pre-screen is the free gate: if the text layer carries no weight-rating terms
 * (a workshop/repair manual, brochure …), we return NO_WEIGHTS without spending any
 * extraction effort. */
export async function extractManualSpecs(
  data: Uint8Array,
  known: KnownSpecs = {},
  opts: { maxPages?: number } = {},
): Promise<ExtractResult> {
  const perPage = await extractPerPageText(data);
  const screen = prescreen(perPage.join('\n'));
  if (!screen.hasWeightData) {
    // Substantial text, no weight-rating phrase → wrong document. Stop here, free.
    return {
      specs: { ...EMPTY_SPECS },
      pagesUsed: [],
      prescreen: screen,
      validation: {
        gvmMatch: null,
        gcmMatch: null,
        axlesPresent: false,
        axlePlausible: false,
      },
      verdict: 'NO_WEIGHTS',
    };
  }

  const pages = pickWeightsPages(perPage, opts.maxPages ?? 3);
  const merged: ManualSpecs = { ...EMPTY_SPECS };
  const pagesUsed: number[] = [];
  for (const { page, text } of pages) {
    pagesUsed.push(page);
    // Text-first: a digital PDF page with a real text layer goes straight to Qwen
    // (faster + more reliable than OCR'ing dense tables). Only render→docling when
    // the text layer is sparse — i.e. a scanned/image page.
    let docText: string;
    if (text.replace(/\s+/g, ' ').trim().length >= 300) {
      docText = text;
    } else {
      docText = await docling(await renderPng(data, page));
    }
    const specs = await qwenExtract(docText);
    for (const k of SPEC_KEYS) {
      if (merged[k] == null && specs[k] != null) merged[k] = specs[k]!;
    }
  }

  // --- validate ---
  const gvmMatch =
    known.gvmKg != null && merged.gvmKg != null
      ? withinPct(merged.gvmKg, known.gvmKg, 3)
      : null;
  const gcmMatch =
    known.gcmKg != null && merged.gcmKg != null
      ? withinPct(merged.gcmKg, known.gcmKg, 3)
      : null;
  const axlesPresent =
    merged.frontAxleLimitKg != null && merged.rearAxleLimitKg != null;
  const gvmForCheck = merged.gvmKg ?? known.gvmKg ?? null;
  const axlePlausible =
    axlesPresent &&
    merged.frontAxleLimitKg! >= 400 &&
    merged.rearAxleLimitKg! >= 400 &&
    merged.frontAxleLimitKg! <= 6000 &&
    merged.rearAxleLimitKg! <= 6000 &&
    (gvmForCheck == null ||
      merged.frontAxleLimitKg! + merged.rearAxleLimitKg! >= gvmForCheck * 0.9);

  let verdict: Verdict;
  if (SPEC_KEYS.every((k) => merged[k] == null)) verdict = 'EMPTY';
  else if (gvmMatch === false)
    verdict = 'REJECT'; // GVM disagrees with known → wrong vehicle/doc
  else if (axlesPresent && axlePlausible)
    verdict = gvmMatch ? 'CONFIRMED' : 'REVIEW';
  else verdict = 'NO_AXLE';

  return {
    specs: merged,
    pagesUsed,
    prescreen: screen,
    validation: { gvmMatch, gcmMatch, axlesPresent, axlePlausible },
    verdict,
  };
}
