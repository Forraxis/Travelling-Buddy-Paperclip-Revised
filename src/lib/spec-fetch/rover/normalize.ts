/**
 * ROVER make/model normalization (VEHICLE_DATA_HUB.md §3.5).
 *
 * ROVER's `make` is applicant free text, so second-stage approvals bake the modifier
 * into it: "PREMCAR D23 Navara" (a Nissan), "IRONMAN TOYOTA HILUX…", "CAR NISSAN…".
 * This recovers the base make/model the hub groups by, and captures the modifier (which
 * becomes a second-stage overlay).
 *
 * Self-bootstrapping: it LEARNS a model→make map from the clean factory rows (whose make
 * is a recognised OEM), then applies it to the messy ones — so "PREMCAR" + model
 * "D23 Navara" resolves to Nissan because a factory "NISSAN | D23 Navara" taught it that
 * "navara"/"d23" → Nissan. Pure (no DB); the runner feeds it the rows.
 */

/** Canonical OEM makes present in the AU light/heavy on-road fleet. */
export const OEM_MAKES: readonly string[] = [
  'Toyota',
  'Nissan',
  'Ford',
  'Mazda',
  'Mitsubishi',
  'Isuzu',
  'Holden',
  'Volkswagen',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Hyundai',
  'Kia',
  'Subaru',
  'Honda',
  'Suzuki',
  'Jeep',
  'RAM',
  'Dodge',
  'Chevrolet',
  'GMC',
  'LDV',
  'GWM',
  'Haval',
  'MG',
  'SsangYong',
  'Land Rover',
  'Jaguar',
  'Volvo',
  'Renault',
  'Peugeot',
  'Citroen',
  'Fiat',
  'Iveco',
  'Scania',
  'MAN',
  'Hino',
  'Mitsubishi Fuso',
  'Kenworth',
  'DAF',
  'Freightliner',
  'Western Star',
  'Mack',
  'UD',
  'Foton',
  'JAC',
  'Polestar',
  'Tesla',
  'BYD',
  'Geely',
  'Chery',
  'Cupra',
  'Skoda',
  'Genesis',
  'Lexus',
  'Porsche',
  'Mini',
  'Ineos',
  'Cadillac',
  'Deepal',
  // ── Added to resolve the NEEDS_REVIEW tail (small-volume but unambiguous AU
  //    makes that were landing as second-stage NEEDS_REVIEW because they weren't
  //    in the seed list). Each only ever appears AS the make in the ROVER grid —
  //    none is a body/coachbuilder modifier — so they're safe to recognise.
  'Aston Martin',
  'Ferrari',
  'Lamborghini',
  'Maserati',
  'Alfa Romeo',
  'Rolls-Royce',
  'Bentley',
  'Lotus',
  'McLaren',
  'Mahindra',
  'FAW',
  'GAC',
  'JMC',
  'Dongfeng',
  'Sinotruk',
  'Shacman',
  'Chenglong',
  'Sany',
  'Yutong',
  'King Long',
  'Zhongtong',
  'Higer',
  'Marcopolo',
  'Irizar',
  'Bonluck',
  'Tatra',
  'Liebherr',
  'Rosenbauer',
  'Jaecoo',
  'Leapmotor',
  'Zeekr',
  'Denza',
  'Omoda',
  'Smart',
  'Forthing',
  'Deepway',
  'BCI',
  'XPeng',
  'NIO',
  'Aion',
  'Skywell',
];

/** Distinctive token → canonical OEM (handles multi-word + abbreviations). */
const OEM_TOKEN_ALIASES: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  benz: 'Mercedes-Benz',
  vw: 'Volkswagen',
  fuso: 'Mitsubishi Fuso',
  landrover: 'Land Rover',
  ssangyong: 'SsangYong',
  greatwall: 'GWM',
  // KGM is SsangYong's post-2024 global rebrand (KG Mobility).
  kgm: 'SsangYong',
  sinotruck: 'Sinotruk',
  // NOTE: multi-word makes (Western Star, Rolls-Royce, Aston Martin, Land Rover) are
  // matched as phrases — we deliberately do NOT alias their generic fragments
  // ("western"/"rolls"/"aston"/"land") to avoid false positives on coachbuilders.
};

/** Tokens that don't identify a model (body/trans/drive noise). */
const NOISE_TOKENS = new Set([
  '2wd',
  '4wd',
  '4x2',
  '4x4',
  '6x4',
  '6x2',
  'awd',
  'fwd',
  'rwd',
  'cab',
  'dual',
  'single',
  'extra',
  'crew',
  'space',
  'auto',
  'manual',
  'amt',
  'ute',
  'wagon',
  'suv',
  'van',
  'truck',
  'bus',
  'pu',
  'dc',
  'sc',
  'hd',
  'gen',
  'lwb',
  'swb',
  'mwb',
  'the',
  'and',
  'series',
  'tm',
  'tt',
  'at',
  'mt',
  'nb1',
  'nb2',
  'na',
  'nc',
  'ma',
  'mc',
  'md',
  'me',
  'motor',
  'home',
  'motorhome',
  'edition',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
}

/** Significant model tokens (drop noise; keep model names + platform codes like d23). */
function modelTokens(model: string): string[] {
  return tokenize(model).filter((t) => !NOISE_TOKENS.has(t));
}

export interface NormalizeResult {
  baseMake: string | null;
  baseModel: string | null;
  modifier: string | null;
  isSecondStage: boolean;
  status: 'AUTO' | 'NEEDS_REVIEW';
}

export class RoverMakeNormalizer {
  /** single-word makes + distinctive aliases → canonical OEM. */
  private readonly oemToken = new Map<string, string>();
  /** multi-word makes matched as a PHRASE, so a generic fragment ("land",
   * "western", "martin") never resolves on its own to Land Rover / Western Star / … */
  private readonly oemPhrases: { tokens: string[]; oem: string }[] = [];
  /** learned: model token → set of canonical OEM makes seen with it on factory rows. */
  private readonly modelTokenToMake = new Map<string, Set<string>>();

  constructor(oems: readonly string[] = OEM_MAKES) {
    for (const oem of oems) {
      const toks = tokenize(oem);
      if (toks.length === 1) {
        // Single-word make (Toyota, MG, UD, RAM) → register its token, any length.
        this.oemToken.set(toks[0], oem);
      } else {
        // Multi-word make → match the whole phrase, never its fragments.
        this.oemPhrases.push({ tokens: toks, oem });
      }
    }
    // Longest phrase first → the most specific match wins.
    this.oemPhrases.sort((a, b) => b.tokens.length - a.tokens.length);
    for (const [token, oem] of Object.entries(OEM_TOKEN_ALIASES)) {
      this.oemToken.set(token, oem);
    }
  }

  /** Resolve a make string to a canonical OEM if it IS / CONTAINS one. */
  private oemInMake(
    make: string,
  ): { oem: string; modifierPrefix: string | null } | null {
    const toks = tokenize(make);
    for (let i = 0; i < toks.length; i++) {
      // A multi-word make phrase starting here (longest-first) takes precedence.
      for (const p of this.oemPhrases) {
        if (
          i + p.tokens.length <= toks.length &&
          p.tokens.every((t, k) => toks[i + k] === t)
        ) {
          const prefix = toks.slice(0, i).join(' ').trim();
          return { oem: p.oem, modifierPrefix: prefix.length ? prefix : null };
        }
      }
      const oem = this.oemToken.get(toks[i]);
      if (oem) {
        const prefix = toks.slice(0, i).join(' ').trim();
        return { oem, modifierPrefix: prefix.length ? prefix : null };
      }
    }
    return null;
  }

  /** Learn the model→make map from rows whose make cleanly identifies an OEM. */
  learnFrom(rows: { make: string | null; model: string | null }[]): void {
    for (const r of rows) {
      if (!r.make || !r.model) continue;
      const m = this.oemInMake(r.make);
      // Only learn from FACTORY rows (make starts with the OEM, no modifier prefix).
      if (!m || m.modifierPrefix) continue;
      for (const t of modelTokens(r.model)) {
        if (!this.modelTokenToMake.has(t))
          this.modelTokenToMake.set(t, new Set());
        this.modelTokenToMake.get(t)!.add(m.oem);
      }
    }
  }

  /** Infer the OEM from the model alone (via the learned map). */
  private oemFromModel(model: string): string | null {
    const votes = new Map<string, number>();
    for (const t of modelTokens(model)) {
      const makes = this.modelTokenToMake.get(t);
      if (makes && makes.size === 1) {
        const oem = [...makes][0];
        votes.set(oem, (votes.get(oem) ?? 0) + 1);
      }
    }
    if (votes.size === 0) return null;
    // Highest-voted unambiguous OEM wins.
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Conservative substring fallback for the model: a model token that *contains*
   * a learned model token as a substring (e.g. "navarahd" → "navara"). Only fires
   * when the learned token is long enough (>=4) to be distinctive and maps to a
   * single OEM, so "d23" never matches inside random codes. Used only after the
   * exact-token vote returns nothing.
   */
  private oemFromModelSubstring(model: string): string | null {
    const votes = new Map<string, number>();
    for (const t of modelTokens(model)) {
      for (const [learned, makes] of this.modelTokenToMake) {
        if (learned.length >= 4 && makes.size === 1 && t.includes(learned)) {
          const oem = [...makes][0];
          votes.set(oem, (votes.get(oem) ?? 0) + 1);
        }
      }
    }
    if (votes.size !== 1) return null; // only resolve when a SINGLE OEM is implied
    return [...votes.keys()][0];
  }

  /**
   * Last-resort: scan the raw grid attributes (the flattened ROVER row JSON) for
   * an OEM token. The grid carries the manufacturer/marketing strings under keys
   * like "cv.rvr_manufacturer" / "vt.rvr_marketingdesignation"; if any string
   * value cleanly contains an OEM token we can recover the base make even when the
   * applicant `make` and `model` columns don't. Conservative: requires exactly one
   * distinct OEM across all scanned string values (ambiguous → null).
   */
  private oemFromRaw(raw: Record<string, unknown>): string | null {
    const found = new Set<string>();
    for (const v of Object.values(raw)) {
      if (typeof v !== 'string') continue;
      const m = this.oemInMake(v);
      if (m) found.add(m.oem);
    }
    return found.size === 1 ? [...found][0] : null;
  }

  /**
   * @param make  applicant `make` free text (may bake in a modifier).
   * @param model applicant `model` free text.
   * @param raw   OPTIONAL flattened ROVER grid attributes (the index `raw` JSON).
   *              When supplied it's a last-resort signal — a make/manufacturer
   *              string buried in the grid can recover the base OEM the make/model
   *              columns miss. The 2-arg call path is unchanged.
   */
  normalize(
    make: string | null,
    model: string | null,
    raw?: Record<string, unknown> | null,
  ): NormalizeResult {
    const cleanModel = model?.trim() || null;
    if (!make?.trim()) {
      return {
        baseMake: null,
        baseModel: cleanModel,
        modifier: null,
        isSecondStage: false,
        status: 'NEEDS_REVIEW',
      };
    }

    const fromMake = this.oemInMake(make);
    if (fromMake) {
      return {
        baseMake: fromMake.oem,
        baseModel: cleanModel,
        modifier: fromMake.modifierPrefix,
        isSecondStage: fromMake.modifierPrefix !== null,
        status: 'AUTO',
      };
    }

    // Make has no OEM token → it's purely a modifier (e.g. "PREMCAR"). Recover the
    // base make from the model via the learned map (exact token vote, then a
    // conservative substring fallback), then from the raw grid attributes.
    const fromModel = cleanModel
      ? (this.oemFromModel(cleanModel) ??
        this.oemFromModelSubstring(cleanModel))
      : null;
    const recovered = fromModel ?? (raw ? this.oemFromRaw(raw) : null);
    if (recovered) {
      return {
        baseMake: recovered,
        baseModel: cleanModel,
        modifier: make.trim(),
        isSecondStage: true,
        status: 'AUTO',
      };
    }

    return {
      baseMake: null,
      baseModel: cleanModel,
      modifier: make.trim(),
      isSecondStage: true,
      status: 'NEEDS_REVIEW',
    };
  }
}
