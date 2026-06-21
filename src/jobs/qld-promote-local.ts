/**
 * QLD fleet → live catalogue promotion (ESTIMATE-pending-plate).
 *
 * Folds the normalised QLD registration fleet (`QldFleetVehicle`, normStatus=AUTO)
 * into the live catalogue (`VehicleMake` / `VehicleModel` / `VehicleVariant`) so users
 * can search their tow vehicle. Per the data-strategy doc + Tim's calls:
 *
 *   • TOW-RELEVANT BODIES ONLY. The AUTO set is the whole QLD light fleet (sedans,
 *     hatches, hearses, buses…). We promote only the bodies a tow rig actually wears
 *     (DUAL CAB / UTILITY / UTE CAB'N'CHASSIS / WAGON / VAN). The rest are skipped.
 *   • ONE MODEL PER NAMEPLATE. Toyota → "HiLux" appears once; bodyType = the family's
 *     dominant tow body. Body + spec live on the VARIANT name (e.g. "Dual Cab 2016–2020").
 *     This is also what lets ROVER GVM-upgrade overlays resolve onto the base later.
 *   • SPEC-GENERATION VARIANT SPLIT. QLD is per (make, model, year, body) with no trim.
 *     We collapse contiguous years that share the same factory GVM into ONE variant with
 *     a real yearFrom–yearTo range; a GVM change starts a new variant. Far cleaner than
 *     one-per-year, and accurate to where the spec actually changed.
 *   • EVERYTHING ESTIMATE. GVM + kerb come from QLD (registration mode). Per-field
 *     VariantSpecProvenance rows are written source=QLD_REGO, status=ESTIMATE — the plate
 *     stays the only promotion to VERIFIED. Axle limits are NOT set (QLD has none).
 *
 * IDEMPOTENT: make upsert by slug, model by (makeId, slug), variant by (modelId, slug),
 * provenance by (variantId, field). Re-running refreshes in place — no duplicates.
 *
 * Usage:
 *   DATABASE_URL=… npx jiti src/jobs/qld-promote-local.ts            # dry-run (default)
 *   DATABASE_URL=… npx jiti src/jobs/qld-promote-local.ts --write    # commit
 *   …                                                  --make=Toyota # one make
 *   …                                                  --min-regs=3  # drop rarer noise (default 2)
 *
 * Run the ROVER base/GVM-upgrade promoters separately (they need RVD expansion via VPN).
 */
import { prisma } from '../lib/db';
import { toSlug } from '../lib/spec-fetch/rover/gvm-upgrade';
import type { VehicleBodyType } from '@prisma/client';

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, def = ''): string => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : def;
};
const WRITE = flag('write');
const DRY = !WRITE; // default dry-run
const MAKE_FILTER = opt('make'); // canonical make, e.g. "Toyota"
const MIN_REGS = parseInt(opt('min-regs') || '2', 10); // per-row floor (let years feed bands)
const MIN_BAND_REGS = parseInt(opt('min-band-regs') || '25', 10); // per-variant floor (kills singletons)
const MIN_BODY_REGS = parseInt(opt('min-body-regs') || '500', 10); // per-(model,body) floor: drops conversion-noise bodies (e.g. a van registered as a Ute)

// ── Year floor (Tim's scope) ──────────────────────────────────────────────────
// Blanket ~2005 floor for high-runners; the iconic long-life rigs go deeper.
const DEFAULT_YEAR_FLOOR = 2005;
const ICONIC_YEAR_FLOOR = 1990;
const ICONIC_MODELS = new Set([
  'HILUX',
  'LANDCRUISER',
  'PATROL',
  'PAJERO',
  'NAVARA',
  'PRADO',
]);
const yearFloor = (canonModel: string): number =>
  ICONIC_MODELS.has(canonModel.trim().toUpperCase())
    ? ICONIC_YEAR_FLOOR
    : DEFAULT_YEAR_FLOOR;

/** Reject objectively-impossible figures (data-entry errors in old QLD records). */
function sane(gvm: number | null, kerb: number | null): boolean {
  if (gvm == null && kerb == null) return false; // no specs → useless for a tow calc
  if (gvm != null && gvm < 1200) return false; // not a light vehicle
  if (gvm != null && kerb != null && (kerb >= gvm || kerb < 600)) return false;
  return true;
}

// ── Tow-relevant body whitelist → (enum bodyType, variant label) ──────────────
// QLD has no SUV body — 4WD wagons + soft-roader SUVs all register as WAGON.
const TOW_BODIES: Record<string, { type: VehicleBodyType; label: string }> = {
  'DUAL CAB': { type: 'DUAL_CAB_UTE', label: 'Dual Cab' },
  UTILITY: { type: 'SINGLE_CAB_UTE', label: 'Ute' },
  "UTE CAB'N'CHASSIS": { type: 'SINGLE_CAB_UTE', label: 'Cab Chassis' },
  WAGON: { type: 'WAGON', label: 'Wagon' },
  VAN: { type: 'VAN', label: 'Van' },
};

// Class-aware conversion-noise suppression: which secondary bodies legitimately
// co-occur with a dominant body (so we DON'T discount genuine factory variants —
// e.g. a Sprinter is van-dominant but Mercedes ships factory cab-chassis + crew-cab).
// A non-dominant body outside its dominant's legit family must clear MIN_BODY_REGS.
const UTE_BODIES = new Set(['DUAL CAB', 'UTILITY', "UTE CAB'N'CHASSIS"]);
function legitBodiesFor(dominant: string): Set<string> {
  if (dominant === 'VAN')
    // vans also ship factory cab-chassis + crew-cab from the OEM
    return new Set(['VAN', "UTE CAB'N'CHASSIS", 'DUAL CAB']);
  if (dominant === 'WAGON' || UTE_BODIES.has(dominant))
    // utes + 4WD wagons share the ute / cab-chassis / wagon family (e.g. LC79)
    return new Set(['DUAL CAB', 'UTILITY', "UTE CAB'N'CHASSIS", 'WAGON']);
  return new Set([dominant]);
}

// ── Light trucks (cab-chassis 4x4s used as tow vehicles) ──────────────────────
// Self-contained (no normalize re-run): Fuso/Hino/Iveco aren't in MAKE_CANON yet, and
// trucks carry concurrent GVM grades (not year generations), so they get their own path.
// QLD gives GVM + kerb only (no GCM/axle) → ESTIMATE; ROVER expansion adds the rest.
const TRUCK_MAKES: Record<string, string> = {
  ISUZU: 'Isuzu',
  FUSO: 'Fuso',
  'MITSUBISHI FUSO': 'Fuso',
  'MITSUBISHI-FUSO': 'Fuso',
  HINO: 'Hino',
  IVECO: 'Iveco',
};
// Cab-chassis-representative bodies (avoid heavy box/tipper bodies that inflate kerb).
const TRUCK_BODIES = new Set([
  "TRUCK CAB'N'CHASSIS",
  'TRAY TRUCK',
  'TRUCK',
  "UTE CAB'N'CHASSIS",
  'CAB CHASSIS',
]);
const ISUZU_N_SERIES = new Set([
  'NLR',
  'NLS',
  'NMR',
  'NNR',
  'NPR',
  'NPS',
  'NQR',
  'NKR',
  'NRR',
]);
/** Map a raw truck model string → curated canonical model, or null to skip. */
function truckModel(displayMake: string, rawModel: string): string | null {
  const m = rawModel.toUpperCase().replace(/\s+/g, ' ').trim();
  if (displayMake === 'Isuzu') {
    const n = m.match(/^(N[A-Z]{2})/);
    if (n && ISUZU_N_SERIES.has(n[1])) return n[1]; // NPR SERIES / NPR300 / NKR150 → NPR / NKR
    if (m === 'ELF') return 'Elf';
    return null;
  }
  if (displayMake === 'Fuso') {
    if (m.includes('CANTER')) return 'Canter';
    if (m.includes('FIGHTER')) return 'Fighter';
    return null;
  }
  if (displayMake === 'Hino') {
    if (m.includes('DUTRO')) return 'Dutro';
    if (m.includes('300')) return '300 Series';
    if (m.includes('500')) return '500 Series';
    return null;
  }
  if (displayMake === 'Iveco') {
    if (m.includes('DAILY')) return 'Daily';
    return null;
  }
  return null;
}
/** True if a (canonical make, model) is one the dedicated truck path owns. */
function isTruckRow(
  canonicalMake: string | null,
  canonicalModel: string | null,
): boolean {
  if (!canonicalMake || !canonicalModel) return false;
  const dm = TRUCK_MAKES[canonicalMake.toUpperCase().trim()];
  return dm ? truckModel(dm, canonicalModel) !== null : false;
}

// ── Display-name overrides for stylised nameplates (canonicalModel is UPPERCASE) ─
const MODEL_DISPLAY: Record<string, string> = {
  HILUX: 'HiLux',
  LANDCRUISER: 'LandCruiser',
  'D-MAX': 'D-Max',
  'MU-X': 'MU-X',
  'BT-50': 'BT-50',
  'X-TRAIL': 'X-Trail',
  'CR-V': 'CR-V',
  'HR-V': 'HR-V',
  RAV4: 'RAV4',
  'C-HR': 'C-HR',
  'CX-3': 'CX-3',
  'CX-30': 'CX-30',
  'CX-5': 'CX-5',
  'CX-8': 'CX-8',
  'CX-9': 'CX-9',
  ASX: 'ASX',
  BRZ: 'BRZ',
  WRX: 'WRX',
};
function displayModel(canon: string): string {
  const k = canon.trim().toUpperCase();
  if (MODEL_DISPLAY[k]) return MODEL_DISPLAY[k];
  // Title-case words; keep short alphanumeric model codes (e.g. GU8, NP300) upper.
  return canon
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      /\d/.test(w) && w.length <= 4
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Row = {
  canonicalMake: string;
  canonicalModel: string;
  yearOfManufacture: number;
  bodyShape: string;
  factoryGvmKg: number | null;
  kerbTareKg: number | null;
  registrationCount: number;
};
type Band = {
  bodyKey: string;
  label: string;
  yearFrom: number;
  yearTo: number;
  gvmKg: number | null;
  kerbWeightKg: number | null;
  regs: number;
};
type Family = {
  make: string;
  model: string;
  bodyType: VehicleBodyType; // dominant tow body
  bands: Band[];
};

const CURRENT_YEAR = 2026;

/** Collapse contiguous same-GVM years (within one body) into spec-generation bands. */
function bandsForBody(bodyKey: string, label: string, rows: Row[]): Band[] {
  const sorted = [...rows].sort(
    (a, b) => a.yearOfManufacture - b.yearOfManufacture,
  );
  const bands: Band[] = [];
  for (const r of sorted) {
    const last = bands[bands.length - 1];
    if (last && last.gvmKg === r.factoryGvmKg) {
      // extend the open band; track the most-registered year's kerb as representative
      last.yearTo = r.yearOfManufacture;
      last.regs += r.registrationCount;
      if (
        r.registrationCount > (last as Band & { _topRegs?: number })._topRegs!
      ) {
        (last as Band & { _topRegs?: number })._topRegs = r.registrationCount;
        last.kerbWeightKg = r.kerbTareKg;
      }
    } else {
      const band: Band & { _topRegs?: number } = {
        bodyKey,
        label,
        yearFrom: r.yearOfManufacture,
        yearTo: r.yearOfManufacture,
        gvmKg: r.factoryGvmKg,
        kerbWeightKg: r.kerbTareKg,
        regs: r.registrationCount,
        _topRegs: r.registrationCount,
      };
      bands.push(band);
    }
  }
  return bands.map(({ ...b }) => {
    delete (b as Band & { _topRegs?: number })._topRegs;
    return b;
  });
}

function variantName(b: Band): string {
  const years =
    b.yearFrom === b.yearTo ? `${b.yearFrom}` : `${b.yearFrom}–${b.yearTo}`;
  return `${b.label} ${years}`;
}

async function buildPlan(): Promise<Family[]> {
  const rows = (await prisma.qldFleetVehicle.findMany({
    where: {
      normStatus: 'AUTO',
      bodyShape: { in: Object.keys(TOW_BODIES) },
      registrationCount: { gte: MIN_REGS },
      canonicalMake: { not: null },
      canonicalModel: { not: null },
      ...(MAKE_FILTER ? { canonicalMake: MAKE_FILTER } : {}),
    },
    select: {
      canonicalMake: true,
      canonicalModel: true,
      yearOfManufacture: true,
      bodyShape: true,
      factoryGvmKg: true,
      kerbTareKg: true,
      registrationCount: true,
    },
  })) as Row[];

  // apply the per-model year floor (iconic rigs go deeper) + drop impossible figures,
  // and hand truck models (e.g. Isuzu NPR — AUTO with some ute-body regs) to the
  // dedicated truck path so they aren't double-promoted as title-cased "Npr" utes.
  const filtered = rows.filter(
    (r) =>
      r.yearOfManufacture >= yearFloor(r.canonicalModel) &&
      sane(r.factoryGvmKg, r.kerbTareKg) &&
      !isTruckRow(r.canonicalMake, r.canonicalModel),
  );

  // Group by the DISPLAY slug, not the raw canonicalModel — QLD carries mixed-case
  // dups (LANDCRUISER / LandCruiser / Landcruiser) that must fold into one model,
  // else they collide on the (modelId, name, year-range) exclusion constraint.
  type Fam = { make: string; nameVotes: Map<string, number>; rows: Row[] };
  const byFamily = new Map<string, Fam>();
  for (const r of filtered) {
    const disp = displayModel(r.canonicalModel);
    const key = `${r.canonicalMake}|${toSlug(disp)}`;
    let fam = byFamily.get(key);
    if (!fam) {
      fam = { make: r.canonicalMake, nameVotes: new Map(), rows: [] };
      byFamily.set(key, fam);
    }
    fam.nameVotes.set(
      disp,
      (fam.nameVotes.get(disp) ?? 0) + r.registrationCount,
    );
    fam.rows.push(r);
  }

  const families: Family[] = [];
  for (const fam of byFamily.values()) {
    // Aggregate to ONE row per (body, year): fold merged-model duplicates, sum regs,
    // take GVM/kerb from the most-registered source for that body+year.
    const agg = new Map<string, Row & { _top: number }>();
    for (const r of fam.rows) {
      const k = `${r.bodyShape}|${r.yearOfManufacture}`;
      const e = agg.get(k);
      if (!e) {
        agg.set(k, { ...r, _top: r.registrationCount });
      } else {
        e.registrationCount += r.registrationCount;
        if (r.registrationCount > e._top) {
          e._top = r.registrationCount;
          e.factoryGvmKg = r.factoryGvmKg;
          e.kerbTareKg = r.kerbTareKg;
        }
      }
    }
    const aggRows = [...agg.values()];

    // dominant body by total regs → the model's bodyType
    const bodyRegs = new Map<string, number>();
    for (const r of aggRows)
      bodyRegs.set(
        r.bodyShape,
        (bodyRegs.get(r.bodyShape) ?? 0) + r.registrationCount,
      );
    const dominantBody = [...bodyRegs.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const bodyType = TOW_BODIES[dominantBody].type;

    // bands per body, then drop low-volume singletons + any still-impossible bands
    const bands: Band[] = [];
    for (const bodyKey of Object.keys(TOW_BODIES)) {
      const brows = aggRows.filter((r) => r.bodyShape === bodyKey);
      if (brows.length === 0) continue;
      // Suppress conversion-noise bodies (a van registered as a tray/wagon) WITHOUT
      // discounting genuine factory variants: keep the dominant body + its legit family
      // always; any other body must clear the per-(model,body) volume floor.
      const legit = legitBodiesFor(dominantBody);
      if (!legit.has(bodyKey) && (bodyRegs.get(bodyKey) ?? 0) < MIN_BODY_REGS)
        continue;
      bands.push(...bandsForBody(bodyKey, TOW_BODIES[bodyKey].label, brows));
    }
    const keptBands = bands.filter(
      (b) => b.regs >= MIN_BAND_REGS && sane(b.gvmKg, b.kerbWeightKg),
    );
    if (keptBands.length === 0) continue; // nothing useful for this family

    // display name = the most-registered casing variant in the merged family
    const model = [...fam.nameVotes.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    families.push({ make: fam.make, model, bodyType, bands: keptBands });
  }

  // light trucks (own path — concurrent GVM grades, Fuso/Hino/Iveco not in MAKE_CANON)
  families.push(...(await buildTruckFamilies()));

  families.sort(
    (a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model),
  );
  return families;
}

/** Curated light-truck families from QLD: one variant per GVM grade (cab-chassis). */
async function buildTruckFamilies(): Promise<Family[]> {
  const rows = await prisma.qldFleetVehicle.findMany({
    where: {
      bodyShape: { in: [...TRUCK_BODIES] },
      factoryGvmKg: { not: null },
      registrationCount: { gte: MIN_REGS },
      yearOfManufacture: { gte: DEFAULT_YEAR_FLOOR },
    },
    select: {
      make: true,
      model: true,
      yearOfManufacture: true,
      factoryGvmKg: true,
      kerbTareKg: true,
      registrationCount: true,
    },
  });

  type TRow = { year: number; gvm: number; kerb: number | null; regs: number };
  const fams = new Map<string, { make: string; model: string; rows: TRow[] }>();
  for (const r of rows) {
    const dm = TRUCK_MAKES[r.make.toUpperCase().trim()];
    if (!dm) continue;
    if (MAKE_FILTER && dm !== MAKE_FILTER) continue;
    const tmodel = truckModel(dm, r.model);
    if (!tmodel) continue;
    if (!sane(r.factoryGvmKg, r.kerbTareKg)) continue;
    const key = `${dm}|${tmodel}`;
    let f = fams.get(key);
    if (!f) {
      f = { make: dm, model: tmodel, rows: [] };
      fams.set(key, f);
    }
    f.rows.push({
      year: r.yearOfManufacture,
      gvm: r.factoryGvmKg!,
      kerb: r.kerbTareKg,
      regs: r.registrationCount,
    });
  }

  const families: Family[] = [];
  for (const f of fams.values()) {
    // group by GVM grade (rounded to nearest 100 to absorb rego rounding noise);
    // keep the modal grade's actual GVM/kerb, span its year range.
    const grades = new Map<
      number,
      {
        gvm: number;
        kerb: number | null;
        y0: number;
        y1: number;
        regs: number;
        top: number;
      }
    >();
    for (const r of f.rows) {
      const k = Math.round(r.gvm / 100) * 100;
      const g = grades.get(k);
      if (!g) {
        grades.set(k, {
          gvm: r.gvm,
          kerb: r.kerb,
          y0: r.year,
          y1: r.year,
          regs: r.regs,
          top: r.regs,
        });
      } else {
        g.y0 = Math.min(g.y0, r.year);
        g.y1 = Math.max(g.y1, r.year);
        g.regs += r.regs;
        if (r.regs > g.top) {
          g.top = r.regs;
          g.gvm = r.gvm;
          g.kerb = r.kerb;
        }
      }
    }
    const bands: Band[] = [];
    for (const g of grades.values()) {
      if (g.regs < MIN_BAND_REGS) continue;
      // GVM in the label keeps each grade's variant name unique within the model.
      bands.push({
        bodyKey: 'TRUCK',
        label: `Cab Chassis ${g.gvm}kg`,
        yearFrom: g.y0,
        yearTo: g.y1,
        gvmKg: g.gvm,
        kerbWeightKg: g.kerb,
        regs: g.regs,
      });
    }
    if (bands.length === 0) continue;
    families.push({ make: f.make, model: f.model, bodyType: 'OTHER', bands });
  }
  return families;
}

async function commitFamily(
  f: Family,
): Promise<{ variants: number; prov: number; ids: string[] }> {
  const make = await prisma.vehicleMake.upsert({
    where: { slug: toSlug(f.make) },
    update: {},
    create: { name: f.make, slug: toSlug(f.make) },
    select: { id: true },
  });
  const model = await prisma.vehicleModel.upsert({
    where: { makeId_slug: { makeId: make.id, slug: toSlug(f.model) } },
    update: { bodyType: f.bodyType, name: f.model },
    create: {
      makeId: make.id,
      name: f.model,
      slug: toSlug(f.model),
      bodyType: f.bodyType,
    },
    select: { id: true },
  });

  let variants = 0;
  let prov = 0;
  const ids: string[] = [];
  for (const b of f.bands) {
    // (label, yearFrom, yearTo) is unique per body within a family → slug is unique.
    const slug = toSlug(`${b.label}-${b.yearFrom}-${b.yearTo}`);
    const name = variantName(b);
    const data = {
      yearFrom: b.yearFrom,
      yearTo: b.yearTo,
      isCurrentProduction: b.yearTo >= CURRENT_YEAR - 1,
      name,
      gvmKg: b.gvmKg,
      kerbWeightKg: b.kerbWeightKg,
    };
    const variant = await prisma.vehicleVariant.upsert({
      where: { modelId_slug: { modelId: model.id, slug } },
      update: data,
      create: { modelId: model.id, slug, status: 'CATALOGUE', ...data },
      select: { id: true },
    });
    variants += 1;
    ids.push(variant.id);

    // per-field ESTIMATE provenance (QLD_REGO)
    const fields: { field: string; value: number | null }[] = [
      { field: 'gvmKg', value: b.gvmKg },
      { field: 'kerbWeightKg', value: b.kerbWeightKg },
    ];
    for (const fld of fields) {
      if (fld.value == null) continue;
      const provData = {
        value: String(fld.value),
        source: 'QLD_REGO' as const,
        status: 'ESTIMATE' as const,
        confidence: 'MEDIUM' as const,
        corroboratingCount: b.regs,
        asOf: new Date(),
        notes: `QLD fleet registration mode · n=${b.regs} · MY ${b.yearFrom}–${b.yearTo}`,
      };
      await prisma.variantSpecProvenance.upsert({
        where: { variantId_field: { variantId: variant.id, field: fld.field } },
        update: provData,
        create: { variantId: variant.id, field: fld.field, ...provData },
      });
      prov += 1;
    }
  }
  return { variants, prov, ids };
}

async function main() {
  console.error(
    `QLD promote — ${DRY ? 'DRY RUN (no DB writes)' : 'WRITE'} · min-regs=${MIN_REGS}` +
      (MAKE_FILTER ? ` · make=${MAKE_FILTER}` : ''),
  );
  console.error(`tow bodies: ${Object.keys(TOW_BODIES).join(', ')}\n`);

  const families = await buildPlan();
  const totalVariants = families.reduce((n, f) => n + f.bands.length, 0);
  const totalProv = families.reduce(
    (n, f) =>
      n +
      f.bands.reduce(
        (m, b) =>
          m + (b.gvmKg != null ? 1 : 0) + (b.kerbWeightKg != null ? 1 : 0),
        0,
      ),
    0,
  );

  // by-make rollup
  const byMake = new Map<string, { models: number; variants: number }>();
  for (const f of families) {
    const e = byMake.get(f.make) ?? { models: 0, variants: 0 };
    e.models += 1;
    e.variants += f.bands.length;
    byMake.set(f.make, e);
  }

  console.error(
    `PLAN: ${byMake.size} makes · ${families.length} models · ${totalVariants} variants · ${totalProv} provenance rows\n`,
  );
  console.error('by make:');
  for (const [mk, e] of [...byMake.entries()].sort(
    (a, b) => b[1].variants - a[1].variants,
  ))
    console.error(
      `  ${mk.padEnd(16)} ${e.models} models  ${e.variants} variants`,
    );

  // sample one big family
  const sample = families.find((f) => f.model === 'HiLux') ?? families[0];
  if (sample) {
    console.error(
      `\nsample — ${sample.make} ${sample.model} (bodyType=${sample.bodyType}):`,
    );
    for (const b of sample.bands.slice(0, 20))
      console.error(
        `  ${variantName(b).padEnd(22)} GVM=${b.gvmKg ?? '—'}  kerb=${b.kerbWeightKg ?? '—'}  n=${b.regs}`,
      );
  }

  if (DRY) {
    console.error(
      '\nDRY RUN — nothing written. Re-run with --write to commit.',
    );
    await prisma.$disconnect();
    return;
  }

  console.error('\nwriting…');
  let v = 0;
  let p = 0;
  let done = 0;
  const writtenIds = new Set<string>();
  for (const f of families) {
    const r = await commitFamily(f);
    v += r.variants;
    p += r.prov;
    for (const id of r.ids) writtenIds.add(id);
    done += 1;
    if (done % 50 === 0)
      console.error(`  ${done}/${families.length} families · ${v} variants`);
  }

  // Reconcile: drop QLD-promoted variants no longer in the plan (stale partial-run
  // remnants / data-refresh leftovers). Scoped to variants carrying QLD_REGO
  // provenance, so ROVER/plate/community variants are untouched. Cascade clears prov.
  const qldVariantIds = (
    await prisma.variantSpecProvenance.findMany({
      where: { source: 'QLD_REGO' },
      select: { variantId: true },
      distinct: ['variantId'],
    })
  ).map((r) => r.variantId);
  const orphanIds = qldVariantIds.filter((id) => !writtenIds.has(id));
  if (orphanIds.length) {
    await prisma.vehicleVariant.deleteMany({
      where: { id: { in: orphanIds } },
    });
  }
  // Drop any now-empty models left behind by the reconcile (no variants at all).
  const emptyModels = await prisma.vehicleModel.findMany({
    where: { variants: { none: {} } },
    select: { id: true },
  });
  if (emptyModels.length) {
    await prisma.vehicleModel.deleteMany({
      where: { id: { in: emptyModels.map((m) => m.id) } },
    });
  }

  console.error(
    `\ndone — ${families.length} models, ${v} variants, ${p} provenance rows (ESTIMATE/QLD_REGO).` +
      `\nreconcile: deleted ${orphanIds.length} stale variants, ${emptyModels.length} empty models.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
