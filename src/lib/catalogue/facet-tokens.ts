/**
 * Canonical catalogue-facet token maps — the single source of truth shared by the
 * facet BACKFILL (src/jobs/backfill-vehicle-facets-local.ts) and the picker free-text
 * SEARCH (CATALOGUE_GRANULARITY_PLAN.md milestone 4, sub-task 1).
 *
 * Keeping derivation and search on the same regexes means a query like
 * "navara 4x4 dual cab" narrows to exactly the variants the backfill tagged 4x4 +
 * dual-cab — they can never drift apart.
 */
import type { CabType, DriveType } from '@prisma/client';

// ── driveType ────────────────────────────────────────────────────────────────
// Precedence 4x4 > AWD > 4x2. FWD/RWD passenger cars stay null — the enum is
// ute/4WD-centric and "4X2" would mis-describe a FWD car.
export const RE_4X4 = /\b4\s*[x×]\s*4\b|\b4wd\b|four[\s-]?wheel[\s-]?drive/i;
export const RE_AWD =
  /\bawd\b|all[\s-]?wheel[\s-]?drive|4-?matic|xdrive|4-?motion|quattro|allgrip|symmetrical/i;
export const RE_4X2 =
  /\b4\s*[x×]\s*2\b|\b2wd\b|two[\s-]?wheel[\s-]?drive|\brwd\b/i;

export function deriveDrive(text: string): DriveType | null {
  if (RE_4X4.test(text)) return 'FOUR_WHEEL_DRIVE';
  if (RE_AWD.test(text)) return 'ALL_WHEEL_DRIVE';
  if (RE_4X2.test(text)) return 'TWO_WHEEL_DRIVE';
  return null;
}

// driveType is @map'd to the AU-ute labels ('4X4'/'4X2'/'AWD') in Postgres, so raw
// SQL must compare against the DB label, not the Prisma member name.
const DRIVE_TO_DB: Record<DriveType, string> = {
  FOUR_WHEEL_DRIVE: '4X4',
  TWO_WHEEL_DRIVE: '4X2',
  ALL_WHEEL_DRIVE: 'AWD',
};
const DRIVE_FROM_DB: Record<string, DriveType> = {
  '4X4': 'FOUR_WHEEL_DRIVE',
  '4X2': 'TWO_WHEEL_DRIVE',
  AWD: 'ALL_WHEEL_DRIVE',
};
export const driveTypeToDbLabel = (d: DriveType): string => DRIVE_TO_DB[d];
export const driveTypeFromDbLabel = (s: string | null): DriveType | null =>
  s ? (DRIVE_FROM_DB[s] ?? null) : null;

// ── cabType ──────────────────────────────────────────────────────────────────
export const RE_DUAL =
  /\bdual[\s-]?cab\b|\bdouble[\s-]?cab\b|\bcrew[\s-]?cab\b|\bd[\s\/-]?cab\b|\bdcc\b/i;
export const RE_KING =
  /\bking[\s-]?cab\b|\bextra[\s-]?cab\b|\bx-?tra[\s-]?cab\b|\bspace[\s-]?cab\b|\bsuper[\s-]?cab\b|\bclub[\s-]?cab\b|\bfreestyle[\s-]?cab\b/i;
export const RE_SINGLE =
  /\bsingle[\s-]?cab\b|\bregular[\s-]?cab\b|\bs[\s\/-]?cab\b/i;
export const RE_WAGON = /\bwagon\b/i;
// short isolated ROVER codes — backfill-only (too aggressive for human queries)
export const RE_DC = /\bdc\b/i;
export const RE_SC = /\bsc\b/i;
export const RE_KC = /\bkc\b/i;

export function deriveCab(
  text: string,
): { cab: CabType; conf: 'MEDIUM' | 'LOW' } | null {
  if (RE_DUAL.test(text)) return { cab: 'DUAL_CAB', conf: 'MEDIUM' };
  if (RE_KING.test(text)) return { cab: 'KING_CAB', conf: 'MEDIUM' };
  if (RE_SINGLE.test(text)) return { cab: 'SINGLE_CAB', conf: 'MEDIUM' };
  if (RE_WAGON.test(text)) return { cab: 'WAGON', conf: 'MEDIUM' };
  if (RE_DC.test(text)) return { cab: 'DUAL_CAB', conf: 'LOW' };
  if (RE_KC.test(text)) return { cab: 'KING_CAB', conf: 'LOW' };
  if (RE_SC.test(text)) return { cab: 'SINGLE_CAB', conf: 'LOW' };
  return null;
}

// ── generation rule table ──────────────────────────────────────────────────────
// Keyed on canonical (UPPER) model nameplate. ONLY models whose generations have
// NON-overlapping year spans, so a [yearFrom,yearTo] overlap test is unambiguous.
export type GenSpan = { gen: string; from: number; to: number };
export const GENERATIONS: Record<string, GenSpan[]> = {
  HILUX: [
    { gen: 'N70', from: 2005, to: 2015 },
    { gen: 'N80', from: 2015, to: 2099 },
  ],
  RANGER: [
    { gen: 'PX', from: 2011, to: 2022 },
    { gen: 'Next-Gen (P703)', from: 2022, to: 2099 },
  ],
  'D-MAX': [
    { gen: 'RT (1st gen)', from: 2008, to: 2012 },
    { gen: 'RT85/MY (facelift)', from: 2012, to: 2020 },
    { gen: 'RG', from: 2020, to: 2099 },
  ],
  'BT-50': [
    { gen: 'UN (1st gen)', from: 2006, to: 2011 },
    { gen: 'UP/UR', from: 2011, to: 2020 },
    { gen: 'TF (Isuzu-based)', from: 2020, to: 2099 },
  ],
  TRITON: [
    { gen: 'ML', from: 2006, to: 2009 },
    { gen: 'MN', from: 2009, to: 2015 },
    { gen: 'MQ/MR', from: 2015, to: 2024 },
    { gen: 'MV (6th gen)', from: 2024, to: 2099 },
  ],
  EVEREST: [
    { gen: 'UA (1st gen)', from: 2015, to: 2022 },
    { gen: 'Next-Gen (UB)', from: 2022, to: 2099 },
  ],
  'MU-X': [
    { gen: '1st gen', from: 2013, to: 2020 },
    { gen: '2nd gen', from: 2020, to: 2099 },
  ],
  'PAJERO SPORT': [{ gen: 'QE/QF', from: 2015, to: 2099 }],
  AMAROK: [
    { gen: '2H (1st gen)', from: 2010, to: 2022 },
    { gen: '2nd gen (Ranger-based)', from: 2022, to: 2099 },
  ],
};

export function deriveGeneration(
  model: string,
  yf: number,
  yt: number,
): string | null {
  const spans = GENERATIONS[model.trim().toUpperCase()];
  if (!spans) return null;
  const hits = spans.filter((s) => yf <= s.to && yt >= s.from);
  return hits.length === 1 ? hits[0].gen : null;
}

// ── transmission ────────────────────────────────────────────────────────────
// Display value, used to disambiguate otherwise-identical configs (e.g. ROVER
// lists ST-X 4x4 in both AT and MT — without this they'd render as duplicate rows).
const RE_AUTO =
  /\b\d{0,2}\s*a\/?t\b|\bauto(?:matic)?\b|\bdct\b|\bcvt\b|\bdsg\b/i;
const RE_MANUAL = /\b\d{0,2}\s*m\/?t\b|\bmanual\b/i;

export function deriveTransmission(text: string): string | null {
  if (RE_AUTO.test(text)) return 'Auto';
  if (RE_MANUAL.test(text)) return 'Manual';
  return null;
}

// ── badge / trim ──────────────────────────────────────────────────────────────
// (1) ROVER per-approval format "<cab> <body> <drive> <trans> <TRIM> (#id)" — the
//     trim is the token(s) after the AT/MT transmission code.
const RE_ROVER_TRIM =
  /\b(?:\d{0,2}A\/?T|\d{0,2}M\/?T)\s+([A-Za-z0-9][\w-]*(?:\s[A-Za-z0-9][\w-]*)?)\s*(?:\(#\d+\))?\s*$/i;
// (2) common explicit AU ute/4WD/SUV grades anywhere in the name (longest first
//     so "ST-X" wins over "ST", "LS-U" over "LS").
const KNOWN_TRIMS = [
  'ST-X',
  'PRO-4X',
  'N-TREK',
  'LS-U',
  'LS-M',
  'LS-T',
  'SR5',
  'GXL',
  'GLX',
  'GLS',
  'GSR',
  'XLT',
  'XLS',
  'Wildtrak',
  'Raptor',
  'Sahara',
  'Workmate',
  'Rogue',
  'Warrior',
  'Exceed',
  'Kakadu',
  'Altitude',
  'ST',
  'SL',
  'SR',
  'GX',
  'XL',
  'LS',
  'LX',
  'RX',
  'VX',
];
const RE_KNOWN = new RegExp(
  '\\b(' + KNOWN_TRIMS.map((t) => t.replace(/-/g, '\\-')).join('|') + ')\\b',
  'i',
);

export function deriveBadge(text: string): string | null {
  const rover = text.match(RE_ROVER_TRIM);
  if (rover) return rover[1].toUpperCase();
  const known = text.match(RE_KNOWN);
  if (known) {
    const hit = known[1].toUpperCase();
    return KNOWN_TRIMS.find((t) => t.toUpperCase() === hit) ?? hit;
  }
  return null;
}

// ── clean display name ──────────────────────────────────────────────────────────
// Compose a human label from the structured facets ("ST-X Dual Cab 4x4 Auto")
// instead of the raw catalogue string ("DC PU 4WD AT ST-X (#054)"). Falls back to
// the raw name when there aren't enough facets to be meaningful (e.g. a clean QLD
// label like "Dual Cab 2015–2020", or an un-parsed code).
const CAB_LABEL: Record<string, string> = {
  SINGLE_CAB: 'Single Cab',
  KING_CAB: 'King Cab',
  DUAL_CAB: 'Dual Cab',
  WAGON: 'Wagon',
};
const DRIVE_DISPLAY: Record<string, string> = {
  FOUR_WHEEL_DRIVE: '4x4',
  TWO_WHEEL_DRIVE: '4x2',
  ALL_WHEEL_DRIVE: 'AWD',
};

// A raw name is "cryptic" when it's a ROVER approval code (carries a (#id), a
// "DC PU"/"SC CC" body code) or a bare alphanumeric model code — these are the
// only names worth replacing. A readable name ("Dual Cab 2015–2020", "Double Cab
// Utility PHEV Platinum 4WD") is left alone so we never drop info the composed
// label can't reproduce (e.g. PHEV/Platinum that aren't extracted facets).
export function looksCryptic(name: string): boolean {
  const t = name.trim();
  return (
    /\(#\d+\)/.test(name) ||
    /\b(?:DC|SC|KC)\s+(?:PU|CC)\b/i.test(name) ||
    // A bare OEM code: one ≥6-char alphanumeric token that CONTAINS A DIGIT.
    // The digit requirement is what separates a code ("GUN125R-BTFLXQ3") from a
    // single-word trim name ("PLATINUM", "WILDTRAK", "SAHARA") — those stay clean.
    (/^[A-Za-z0-9-]{6,}$/.test(t) && /\d/.test(t))
  );
}

export function cleanVehicleName(opts: {
  name: string;
  badge?: string | null;
  cabType?: string | null;
  driveType?: string | null;
  transmission?: string | null;
}): string {
  const parts = [
    opts.badge ?? undefined,
    opts.cabType ? CAB_LABEL[opts.cabType] : undefined,
    opts.driveType ? DRIVE_DISPLAY[opts.driveType] : undefined,
    opts.transmission ?? undefined,
  ].filter(Boolean) as string[];
  // Only rewrite a cryptic code-name, and only when we have ≥2 facets to compose
  // a meaningful label; otherwise keep the (readable) raw name.
  return parts.length >= 2 && looksCryptic(opts.name)
    ? parts.join(' ')
    : opts.name;
}

// ── build origin / country of manufacture ────────────────────────────────────
// A variant's buildOrigin is an ISO-3166 alpha-2 code. Some model-years ship from
// >1 plant with materially different GVM/axle/dims (D40 Navara: ES vs TH). Display
// = flag + English name; the picker only surfaces the facet when a model-year
// actually carries >1 distinct value (CATALOGUE_GRANULARITY_PLAN.md §4).
export const COUNTRY: Record<string, { flag: string; name: string }> = {
  ES: { flag: '🇪🇸', name: 'Spain' },
  TH: { flag: '🇹🇭', name: 'Thailand' },
  JP: { flag: '🇯🇵', name: 'Japan' },
  AU: { flag: '🇦🇺', name: 'Australia' },
  AR: { flag: '🇦🇷', name: 'Argentina' },
  ZA: { flag: '🇿🇦', name: 'South Africa' },
  DE: { flag: '🇩🇪', name: 'Germany' },
  GB: { flag: '🇬🇧', name: 'United Kingdom' },
  US: { flag: '🇺🇸', name: 'USA' },
  KR: { flag: '🇰🇷', name: 'South Korea' },
  CN: { flag: '🇨🇳', name: 'China' },
  IN: { flag: '🇮🇳', name: 'India' },
  MX: { flag: '🇲🇽', name: 'Mexico' },
  TR: { flag: '🇹🇷', name: 'Türkiye' },
};

/** Country code → "🇪🇸 Spain" for display; unknown codes pass through verbatim. */
export function formatOrigin(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = COUNTRY[code.toUpperCase()];
  return c ? `${c.flag} ${c.name}` : code;
}

// Free-text → country code (country names + well-known build-plant cities), so a
// query like "navara spain" or "ranger argentina" filters by build origin.
const ORIGIN_TOKENS: { re: RegExp; code: string }[] = [
  { re: /\b(spain|spanish|barcelona|iberica|iberian)\b/i, code: 'ES' },
  { re: /\b(thailand|thai|sriracha|samut|bangkok)\b/i, code: 'TH' },
  { re: /\b(japan|japanese)\b/i, code: 'JP' },
  { re: /\b(argentin\w*|pacheco)\b/i, code: 'AR' },
  { re: /\b(south\s*africa\w*|rosslyn|silverton)\b/i, code: 'ZA' },
  { re: /\b(german\w*|hannover|hanover)\b/i, code: 'DE' },
  { re: /\b(korea\w*)\b/i, code: 'KR' },
];

export function deriveOriginToken(
  text: string,
): { code: string; re: RegExp } | null {
  for (const t of ORIGIN_TOKENS)
    if (t.re.test(text)) return { code: t.code, re: t.re };
  return null;
}

// ── caravan body length (AU "feet" convention) ──────────────────────────────────
// Aussie caravans are described by BODY length in feet+inches (a "16'6 van"), not
// overall length (which adds the drawbar). We bucket bodyLengthMm to the nearest
// ½-foot so search + facets line up with how vans are actually sold.
export function bodyFeetHalf(mm: number | null | undefined): number | null {
  if (!mm || mm <= 0) return null;
  return Math.round((mm / 304.8) * 2) / 2;
}
/** ½-foot value → AU label, e.g. 16.5 → `16'6"`, 18 → `18'0"`. */
export function formatFeet(ft: number | null | undefined): string | null {
  if (ft == null) return null;
  const whole = Math.floor(ft);
  const inches = Math.round((ft - whole) * 12);
  return `${whole}'${inches}"`;
}
// ── query parsers (search) ─────────────────────────────────────────────────────
// Pull the EXACT-match enum facets out of a free-text query and return the leftover
// words. generation/badge are NOT parsed here — they stay in the remainder and are
// matched as free text against those columns (so "d40" / "st-x" still hit).

// A 4-digit model year. Parsed to an exact range filter so "navara 2008" can't
// fuzzy-trigram-match every 200x year (the "2008" ↔ "2003–2006" false-match bug).
const RE_YEAR = /\b(?:19|20)\d{2}\b/;

export interface VehicleFacetQuery {
  driveType?: DriveType;
  cabType?: CabType;
  year?: number;
  buildOrigin?: string;
  remainder: string;
}

export function parseVehicleQuery(q: string): VehicleFacetQuery {
  let remainder = q;
  const strip = (re: RegExp) => {
    remainder = remainder.replace(new RegExp(re.source, 'gi'), ' ');
  };
  const out: VehicleFacetQuery = { remainder: q };

  const ym = q.match(RE_YEAR);
  if (ym) {
    out.year = parseInt(ym[0], 10);
    strip(RE_YEAR);
  }

  const origin = deriveOriginToken(q);
  if (origin) {
    out.buildOrigin = origin.code;
    strip(origin.re);
  }

  if (RE_4X4.test(q)) {
    out.driveType = 'FOUR_WHEEL_DRIVE';
    strip(RE_4X4);
  } else if (RE_AWD.test(q)) {
    out.driveType = 'ALL_WHEEL_DRIVE';
    strip(RE_AWD);
  } else if (RE_4X2.test(q)) {
    out.driveType = 'TWO_WHEEL_DRIVE';
    strip(RE_4X2);
  }

  // Spelled-out cab forms only — short codes (DC/SC/KC) are too aggressive for human queries.
  if (RE_DUAL.test(q)) {
    out.cabType = 'DUAL_CAB';
    strip(RE_DUAL);
  } else if (RE_KING.test(q)) {
    out.cabType = 'KING_CAB';
    strip(RE_KING);
  } else if (RE_SINGLE.test(q)) {
    out.cabType = 'SINGLE_CAB';
    strip(RE_SINGLE);
  } else if (RE_WAGON.test(q)) {
    out.cabType = 'WAGON';
    strip(RE_WAGON);
  }

  out.remainder = remainder.replace(/\s+/g, ' ').trim();
  return out;
}

export interface CaravanFacetQuery {
  berths?: number;
  year?: number;
  lengthFt?: number;
  remainder: string;
}

const RE_BERTH = /\b(\d{1,2})\s*(?:berth|berths|sleeper|sleeps?)\b/i;
// Body length: "16'6", "16'6\"", "16ft 6", "16 foot 6in" → feet+inches.
const RE_FT_IN =
  /\b(\d{1,2})\s*(?:'|ft|foot|feet)\s*(\d{1,2})?\s*(?:"|in|inch|inches)?/i;
// Decimal feet: "16.5".
const RE_FT_DEC = /\b(\d{1,2})\.(\d)\b/;

export function parseCaravanQuery(q: string): CaravanFacetQuery {
  const out: CaravanFacetQuery = { remainder: q };
  let remainder = q;
  const m = remainder.match(RE_BERTH);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 12) out.berths = n;
    remainder = remainder.replace(new RegExp(RE_BERTH.source, 'gi'), ' ');
  }
  // Year before length so "2008" can't be misread as feet.
  const ym = remainder.match(RE_YEAR);
  if (ym) {
    out.year = parseInt(ym[0], 10);
    remainder = remainder.replace(new RegExp(RE_YEAR.source, 'g'), ' ');
  }
  const fi = remainder.match(RE_FT_IN);
  const fd = !fi ? remainder.match(RE_FT_DEC) : null;
  if (fi) {
    const ft = parseInt(fi[1], 10) + (fi[2] ? parseInt(fi[2], 10) / 12 : 0);
    if (ft >= 8 && ft <= 40) out.lengthFt = Math.round(ft * 2) / 2;
    remainder = remainder.replace(fi[0], ' ');
  } else if (fd) {
    const ft = parseFloat(`${fd[1]}.${fd[2]}`);
    if (ft >= 8 && ft <= 40) out.lengthFt = Math.round(ft * 2) / 2;
    remainder = remainder.replace(fd[0], ' ');
  }
  out.remainder = remainder.replace(/\s+/g, ' ').trim();
  return out;
}

// pg_trgm word-similarity floor for fuzzy nameplate matches (typo tolerance).
export const TRGM_THRESHOLD = 0.4;
