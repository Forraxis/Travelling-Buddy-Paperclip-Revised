/**
 * Second-stage classifier (OVERNIGHT_BUILD_FULL.md Phase P2).
 *
 * Once `RoverMakeNormalizer` has flagged a ROVER row as second-stage (the applicant
 * `make` carries a modifier the base OEM didn't), this decides WHAT KIND of
 * second-stage manufacture it is — which drives promotion routing downstream (P4):
 *
 *   GVM_UPGRADE → a suspension/mass uprate over the factory base. Promotes to a
 *                 `GvmUpgrade` overlay ON the base variant, not a standalone variant.
 *   MOTORHOME   → a habitation build (Avida/Jayco/Sunliner on a Fiat Ducato, etc.).
 *   CONVERSION  → a body/role conversion (tray, bus body, ambulance, …).
 *   OTHER       → second-stage but none of the above signals fired.
 *   NONE        → not second-stage (a clean factory/OEM row).
 *
 * Pure + deterministic (no DB, no clock). The runner looks up the base factory
 * category for the row's base make/model and feeds it in as `baseCategory`.
 *
 * GVM_UPGRADE is the highest-priority signal: per the spec it fires on a known GVM
 * brand, an explicit "GVM"/"upgrade" token, OR a goods-category bump above the base
 * (NA → NB1/NB2). A GVM uprate is the load-bearing compliance fact even when the end
 * product is also a motorhome (e.g. "Pedders … GVM PLUS … MOTORHOME"), so the
 * overlay routing it triggers is still the right one. MOTORHOME/CONVERSION keywords
 * are checked only after GVM signals are ruled out.
 */

/** Known GVM/suspension uprate brands (lower-cased, matched as whole words). */
export const GVM_UPGRADE_BRANDS: readonly string[] = [
  'ironman',
  'premcar',
  'lovells',
  'pedders',
  'mrt',
  'arb',
  'tjm',
  'fulcrum',
  'dobinsons',
  'westcoast',
  'roadsafe',
  'superior',
  '4wsusp',
  'tough dog',
  'old man emu',
  'ome',
];

/** Tokens that explicitly mark a mass/suspension uprate in the make/model/raw text. */
const GVM_KEYWORD_RE = /\bgvm\b|\bgcm\b|\bupgrade\b|\bup-?rate\b/i;

/** Habitation-build keywords. */
const MOTORHOME_RE =
  /\bmotor\s*home\b|\bmotorhome\b|\bcamper\s*van\b|\bcampervan\b|\bmotor caravan\b|\brv\b/i;

/**
 * Body/role conversion keywords. Deliberately narrow so a stock ute-tray doesn't
 * over-trigger — these denote a substantive body or role change.
 */
const CONVERSION_RE =
  /\bconversion\b|\bconvert(?:ed)?\b|\bbus\b|\bomnibus\b|\bcoach\b|\bambulance\b|\bhearse\b|\bmobile\b|\btray\b|\bservice body\b|\barmou?red\b|\bwheelchair\b|\baccess\b/i;

/**
 * Goods-vehicle (N-series) mass-category rank. A second-stage row whose ADR category
 * sits ABOVE its factory base's category is a tell-tale GVM upgrade (a ~3.3 t ute,
 * factory NA, re-categorised NB1 once its GVM clears 3.5 t). M-series (passenger/bus)
 * categories are not part of this ladder — bumps there are bodywork, not GVM uprates.
 */
const GOODS_CATEGORY_RANK: Record<string, number> = {
  NA: 1,
  NB1: 2,
  NB2: 3,
  NC: 4,
};

function goodsRank(category: string | null | undefined): number | null {
  if (!category) return null;
  return GOODS_CATEGORY_RANK[category.trim().toUpperCase()] ?? null;
}

/**
 * True when `category` is a goods category strictly above `baseCategory` on the
 * N-series ladder (e.g. base NA, row NB1). Only fires when BOTH are goods categories.
 */
export function isCategoryBumped(
  category: string | null | undefined,
  baseCategory: string | null | undefined,
): boolean {
  const r = goodsRank(category);
  const b = goodsRank(baseCategory);
  if (r === null || b === null) return false;
  return r > b;
}

function hasGvmBrand(haystack: string): boolean {
  const h = haystack.toLowerCase();
  return GVM_UPGRADE_BRANDS.some((brand) => {
    // Whole-token match so "arb" doesn't hit inside "garbage"; brands with a space
    // (e.g. "old man emu") are matched as a phrase with word boundaries.
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(h);
  });
}

export type SecondStageType =
  | 'NONE'
  | 'GVM_UPGRADE'
  | 'CONVERSION'
  | 'MOTORHOME'
  | 'OTHER';

export interface ClassifyInput {
  /** Did the normalizer flag this row as second-stage? */
  isSecondStage: boolean;
  /** Applicant make free text ("PEDDERS TOYOTA"). */
  make: string | null;
  /** Applicant model free text ("HILUX GVM PLUS NB"). */
  model: string | null;
  /** Captured modifier ("Pedders"), if the normalizer isolated one. */
  modifier: string | null;
  /** ADR category of THIS row ("NB1"). */
  category: string | null;
  /**
   * Factory category of the BASE make/model (looked up from the OEM rows) — used to
   * detect a goods-category bump. `null`/unknown simply disables the bump signal.
   */
  baseCategory: string | null;
  /** Flattened ROVER grid attributes (raw JSON) — scanned for GVM keywords. */
  raw: Record<string, unknown> | null | undefined;
}

/** Flatten the searchable string fields of a row into one lower-cased blob. */
function rowText(input: ClassifyInput): string {
  const parts: string[] = [];
  if (input.make) parts.push(input.make);
  if (input.model) parts.push(input.model);
  if (input.modifier) parts.push(input.modifier);
  if (input.raw) {
    for (const v of Object.values(input.raw)) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  return parts.join(' ');
}

/**
 * Classify a (possibly) second-stage ROVER row. Pure: same input → same output.
 */
export function classifySecondStage(input: ClassifyInput): SecondStageType {
  if (!input.isSecondStage) return 'NONE';

  const text = rowText(input);

  // ── GVM_UPGRADE (highest priority) ──────────────────────────────────────────
  // A known GVM brand, an explicit GVM/upgrade keyword, or a goods-category bump.
  if (
    hasGvmBrand(text) ||
    GVM_KEYWORD_RE.test(text) ||
    isCategoryBumped(input.category, input.baseCategory)
  ) {
    return 'GVM_UPGRADE';
  }

  // ── MOTORHOME ───────────────────────────────────────────────────────────────
  if (MOTORHOME_RE.test(text)) return 'MOTORHOME';

  // ── CONVERSION ──────────────────────────────────────────────────────────────
  if (CONVERSION_RE.test(text)) return 'CONVERSION';

  // ── OTHER ───────────────────────────────────────────────────────────────────
  return 'OTHER';
}
