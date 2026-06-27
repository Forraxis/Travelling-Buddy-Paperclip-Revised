/**
 * Vehicle catalogue-granularity facet backfill — phase 1 (the "free" derivations).
 * CATALOGUE_GRANULARITY_PLAN.md milestone 2, step 1.
 *
 * Fills the new VehicleVariant facet columns from data ALREADY in hand (the
 * variant/model names), with no new fetch:
 *
 *   • driveType  ← name tokens (4x4 / 4x2 / AWD / 4MATIC / xDrive / quattro …).
 *                  Highest number-impact facet. ute 4x4↔4x2 swings kerb/GVM.
 *   • cabType    ← name tokens (Dual/King/Extra/Single cab, Wagon). Only assigned
 *                  when the cab config is EXPLICIT — "Ute"/"Cab Chassis"/"Utility"
 *                  alone are ambiguous → left null (no fabrication, Rule 11).
 *   • generation ← a focused (model → year-span) rule table, ONLY for major tow
 *                  models whose generations DON'T overlap in years. Where spans
 *                  overlap (e.g. Navara D22 vs D40 both sold 2005–2015) a year
 *                  rule can't disambiguate → left null; that needs the ROVER
 *                  baseModel link (step 2) or the plate. We never guess.
 *
 * badge / engine / transmission are deliberately NOT done here — they belong to
 * the ROVER structured pass (step 2), which carries them per-approval.
 *
 * FILL-EMPTIES-ONLY: a facet column that is already set (e.g. by a later ROVER /
 * plate pass) is left untouched, so re-running is safe and never clobbers a
 * better source. Pass --force to overwrite. Per-field VariantSpecProvenance rows
 * are written source=MANUAL (derived), status=ESTIMATE — the plate stays the only
 * promotion to truth. All flagged pending Tim's Rule-11 sign-off.
 *
 * IDEMPOTENT: variant facet columns by id; provenance by (variantId, field).
 *
 * Usage:
 *   DATABASE_URL=… npx jiti src/jobs/backfill-vehicle-facets-local.ts            # dry-run (default)
 *   DATABASE_URL=… npx jiti src/jobs/backfill-vehicle-facets-local.ts --write    # commit
 *   …                                                          --make=Nissan     # one make
 *   …                                                          --force           # overwrite set facets
 */
import { prisma } from '../lib/db';
import type { CabType, DriveType } from '@prisma/client';
import {
  deriveDrive,
  deriveCab,
  deriveGeneration,
  deriveBadge,
  deriveTransmission,
  driveTypeToDbLabel,
} from '../lib/catalogue/facet-tokens';

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, def = ''): string => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : def;
};
const WRITE = flag('write');
const DRY = !WRITE;
const FORCE = flag('force');
const MAKE_FILTER = opt('make');

// Derivation logic (driveType / cabType / generation maps) lives in the shared
// facet-tokens module so this backfill and the picker free-text search stay in lock-step.

// ── main ───────────────────────────────────────────────────────────────────────
type Row = {
  id: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  driveType: DriveType | null;
  cabType: CabType | null;
  generation: string | null;
  badge: string | null;
  transmission: string | null;
  model: { name: string; make: { name: string } };
};

async function main() {
  console.error(
    `Vehicle facet backfill — ${DRY ? 'DRY RUN (no writes)' : 'WRITE'}` +
      (MAKE_FILTER ? ` · make=${MAKE_FILTER}` : '') +
      (FORCE ? ' · FORCE (overwrite set facets)' : ' · fill-empties-only'),
  );

  const variants: Row[] = await prisma.vehicleVariant.findMany({
    where: MAKE_FILTER ? { model: { make: { name: MAKE_FILTER } } } : undefined,
    select: {
      id: true,
      name: true,
      yearFrom: true,
      yearTo: true,
      driveType: true,
      cabType: true,
      generation: true,
      badge: true,
      transmission: true,
      model: { select: { name: true, make: { select: { name: true } } } },
    },
  });

  const stat = {
    drive: { '4X4': 0, '4X2': 0, AWD: 0 } as Record<string, number>,
    cab: { DUAL_CAB: 0, KING_CAB: 0, SINGLE_CAB: 0, WAGON: 0 } as Record<
      string,
      number
    >,
    gen: 0,
    badge: 0,
    trans: 0,
    rows: 0,
    prov: 0,
    skipped: 0,
  };
  for (const v of variants) {
    const text = `${v.name} ${v.model.name}`;
    const drive = deriveDrive(text);
    const cabHit = deriveCab(text);
    const gen = deriveGeneration(v.model.name, v.yearFrom, v.yearTo);
    // badge/transmission parse the variant name ALONE — RE_ROVER_TRIM anchors on
    // the end of the string, which appending the model name would break.
    const badge = deriveBadge(v.name);
    const transmission = deriveTransmission(v.name);

    const colUpdate: {
      driveType?: DriveType;
      cabType?: CabType;
      generation?: string;
      badge?: string;
      transmission?: string;
    } = {};
    const provWrites: {
      field: string;
      value: string;
      confidence: 'MEDIUM' | 'LOW';
      note: string;
    }[] = [];

    if (drive && (FORCE || v.driveType == null)) {
      colUpdate.driveType = drive;
      stat.drive[driveTypeToDbLabel(drive)]++;
      provWrites.push({
        field: 'driveType',
        value: driveTypeToDbLabel(drive),
        confidence: 'MEDIUM',
        note: `derived from variant-name drivetrain token`,
      });
    }
    if (cabHit && (FORCE || v.cabType == null)) {
      colUpdate.cabType = cabHit.cab;
      stat.cab[cabHit.cab]++;
      provWrites.push({
        field: 'cabType',
        value: cabHit.cab,
        confidence: cabHit.conf,
        note: `derived from variant-name cab token`,
      });
    }
    if (gen && (FORCE || v.generation == null)) {
      colUpdate.generation = gen;
      stat.gen++;
      provWrites.push({
        field: 'generation',
        value: gen,
        confidence: 'MEDIUM',
        note: `derived from ${v.model.name} generation year-span rule`,
      });
    }
    if (badge && (FORCE || v.badge == null)) {
      colUpdate.badge = badge;
      stat.badge++;
      provWrites.push({
        field: 'badge',
        value: badge,
        confidence: 'MEDIUM',
        note: `derived from variant-name trim token`,
      });
    }
    if (transmission && (FORCE || v.transmission == null)) {
      colUpdate.transmission = transmission;
      stat.trans++;
      provWrites.push({
        field: 'transmission',
        value: transmission,
        confidence: 'MEDIUM',
        note: `derived from variant-name transmission token`,
      });
    }

    if (Object.keys(colUpdate).length === 0) {
      stat.skipped++;
      continue;
    }
    stat.rows++;
    stat.prov += provWrites.length;

    if (!DRY) {
      await prisma.vehicleVariant.update({
        where: { id: v.id },
        data: colUpdate,
      });
      for (const p of provWrites) {
        const provData = {
          value: p.value,
          source: 'MANUAL' as const,
          status: 'ESTIMATE' as const,
          confidence: p.confidence,
          corroboratingCount: 0,
          asOf: new Date(),
          notes: `${p.note} — pending Rule-11 sign-off`,
        };
        await prisma.variantSpecProvenance.upsert({
          where: { variantId_field: { variantId: v.id, field: p.field } },
          update: provData,
          create: { variantId: v.id, field: p.field, ...provData },
        });
      }
    }
  }

  console.error(
    `\nscanned ${variants.length} variants · ${stat.rows} updated · ${stat.skipped} unchanged · ${stat.prov} provenance rows`,
  );
  console.error(
    `  driveType: 4x4=${stat.drive['4X4']} 4x2=${stat.drive['4X2']} awd=${stat.drive.AWD} (total ${stat.drive['4X4'] + stat.drive['4X2'] + stat.drive.AWD})`,
  );
  console.error(
    `  cabType:   dual=${stat.cab.DUAL_CAB} king=${stat.cab.KING_CAB} single=${stat.cab.SINGLE_CAB} wagon=${stat.cab.WAGON} (total ${stat.cab.DUAL_CAB + stat.cab.KING_CAB + stat.cab.SINGLE_CAB + stat.cab.WAGON})`,
  );
  console.error(`  generation: ${stat.gen}`);
  console.error(`  badge: ${stat.badge}  transmission: ${stat.trans}`);

  // Worked example — Navara (overlapping-gen → generation should stay null)
  const navara = await prisma.vehicleVariant.findMany({
    where: { model: { name: { contains: 'Navara' } } },
    select: {
      name: true,
      yearFrom: true,
      yearTo: true,
      driveType: true,
      cabType: true,
      generation: true,
    },
    take: 12,
  });
  if (navara.length) {
    console.error(
      `\nworked example — Navara (post-derivation${DRY ? ', dry' : ''}):`,
    );
    for (const v of navara)
      console.error(
        `  "${v.name}" ${v.yearFrom}-${v.yearTo} → drive=${v.driveType ?? '—'} cab=${v.cabType ?? '—'} gen=${v.generation ?? '—'}`,
      );
  }

  if (DRY)
    console.error(
      '\nDRY RUN — nothing written. Re-run with --write to commit.',
    );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
