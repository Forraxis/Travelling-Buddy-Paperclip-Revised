/**
 * Seed the 17 carsales gap-vehicles into the catalogue from the brave-extracted PDF specs.
 *
 * brave-land only ENRICHES existing variants (it needs a gvmKg already present), so these
 * brand-new models (absent from the QLD spine) never landed. This creates their identity
 * (make→model→variant) and lands the median brochure specs into the variant columns +
 * VariantSpecProvenance rows (source=CLAUDE, status=ESTIMATE — "live but flagged", pending
 * Tim's Rule-11 sign-off, same posture as the caravan land).
 *
 * Reads ops/n8n/.brave-extracted.jsonl (the docling/qwen output). Idempotent (upserts).
 *
 *   DATABASE_URL=… npx tsx src/jobs/carsales-seed-gapfill-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/carsales-seed-gapfill-local.ts --write
 */
import { readFileSync } from 'node:fs';
import type { VehicleBodyType, SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const SRC = 'ops/n8n/.brave-extracted.jsonl';

// the 17, with the VMAP vehicle key (= the 'vehicle' tag on extracted rows)
const TARGETS: {
  vehicle: string;
  make: string;
  modelName: string;
  modelSlug: string;
  bodyType: VehicleBodyType;
  yearFrom: number;
}[] = [
  {
    vehicle: 'gwm tank 300',
    make: 'GWM',
    modelName: 'Tank 300',
    modelSlug: 'tank-300',
    bodyType: 'SUV',
    yearFrom: 2023,
  },
  {
    vehicle: 'gwm tank 500',
    make: 'GWM',
    modelName: 'Tank 500',
    modelSlug: 'tank-500',
    bodyType: 'SUV',
    yearFrom: 2024,
  },
  {
    vehicle: 'gwm cannon alpha',
    make: 'GWM',
    modelName: 'Cannon Alpha',
    modelSlug: 'cannon-alpha',
    bodyType: 'DUAL_CAB_UTE',
    yearFrom: 2024,
  },
  {
    vehicle: 'gwm haval h6',
    make: 'GWM',
    modelName: 'Haval H6',
    modelSlug: 'haval-h6',
    bodyType: 'SUV',
    yearFrom: 2021,
  },
  {
    vehicle: 'gwm haval h7',
    make: 'GWM',
    modelName: 'Haval H7',
    modelSlug: 'haval-h7',
    bodyType: 'SUV',
    yearFrom: 2024,
  },
  {
    vehicle: 'gwm haval jolion',
    make: 'GWM',
    modelName: 'Haval Jolion',
    modelSlug: 'haval-jolion',
    bodyType: 'SUV',
    yearFrom: 2021,
  },
  {
    vehicle: 'mazda cx-60',
    make: 'Mazda',
    modelName: 'CX-60',
    modelSlug: 'cx-60',
    bodyType: 'SUV',
    yearFrom: 2023,
  },
  {
    vehicle: 'mazda cx-70',
    make: 'Mazda',
    modelName: 'CX-70',
    modelSlug: 'cx-70',
    bodyType: 'SUV',
    yearFrom: 2025,
  },
  {
    vehicle: 'mazda cx-80',
    make: 'Mazda',
    modelName: 'CX-80',
    modelSlug: 'cx-80',
    bodyType: 'SUV',
    yearFrom: 2024,
  },
  {
    vehicle: 'mazda cx-90',
    make: 'Mazda',
    modelName: 'CX-90',
    modelSlug: 'cx-90',
    bodyType: 'SUV',
    yearFrom: 2023,
  },
  {
    vehicle: 'ford bronco',
    make: 'Ford',
    modelName: 'Bronco',
    modelSlug: 'bronco',
    bodyType: 'SUV',
    yearFrom: 2023,
  },
  {
    vehicle: 'ford e-transit',
    make: 'Ford',
    modelName: 'E-Transit',
    modelSlug: 'e-transit',
    bodyType: 'VAN',
    yearFrom: 2022,
  },
  {
    vehicle: 'jeep avenger',
    make: 'Jeep',
    modelName: 'Avenger',
    modelSlug: 'avenger',
    bodyType: 'SUV',
    yearFrom: 2024,
  },
  {
    vehicle: 'jeep renegade',
    make: 'Jeep',
    modelName: 'Renegade',
    modelSlug: 'renegade',
    bodyType: 'SUV',
    yearFrom: 2015,
  },
  {
    vehicle: 'volkswagen tayron',
    make: 'Volkswagen',
    modelName: 'Tayron',
    modelSlug: 'tayron',
    bodyType: 'SUV',
    yearFrom: 2024,
  },
  {
    vehicle: 'volkswagen id buzz',
    make: 'Volkswagen',
    modelName: 'ID. Buzz',
    modelSlug: 'id-buzz',
    bodyType: 'VAN',
    yearFrom: 2024,
  },
  {
    vehicle: 'nissan ariya',
    make: 'Nissan',
    modelName: 'Ariya',
    modelSlug: 'ariya',
    bodyType: 'SUV',
    yearFrom: 2023,
  },
];

// extracted spec field → variant column, with sane bounds (drop garbage from bad PDFs)
const SPECS: { key: string; col: string; lo: number; hi: number }[] = [
  { key: 'gvmKg', col: 'gvmKg', lo: 1500, hi: 5000 },
  { key: 'gcmKg', col: 'gcmKg', lo: 3000, hi: 9000 },
  { key: 'kerbWeightKg', col: 'kerbWeightKg', lo: 1200, hi: 4000 },
  { key: 'maxTowingCapacityKg', col: 'maxTowingCapacityKg', lo: 500, hi: 4500 },
  { key: 'maxTowBallDownloadKg', col: 'maxTowBallDownloadKg', lo: 50, hi: 450 },
  { key: 'frontAxleLimitKg', col: 'frontAxleLimitKg', lo: 800, hi: 2500 },
  { key: 'rearAxleLimitKg', col: 'rearAxleLimitKg', lo: 800, hi: 2800 },
  { key: 'wheelbaseMm', col: 'wheelbaseMm', lo: 2000, hi: 4000 },
  { key: 'frontOverhangMm', col: 'frontOverhangMm', lo: 600, hi: 1400 },
  { key: 'rearOverhangMm', col: 'rearOverhangMm', lo: 600, hi: 1600 },
  { key: 'totalLengthMm', col: 'totalLengthMm', lo: 3500, hi: 6500 },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function main() {
  const rows = readFileSync(SRC, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(
      (l) =>
        JSON.parse(l) as {
          vehicle: string;
          specs?: Record<string, number | null>;
        },
    );

  console.log(
    `\n=== CARSALES GAP-FILL SEED (${WRITE ? 'WRITE' : 'dry-run'}) · ${TARGETS.length} models ===\n`,
  );
  let created = 0,
    provRows = 0,
    noData = 0;

  for (const t of TARGETS) {
    // median each spec across this vehicle's findings (sane values only)
    const found = rows.filter((r) => r.vehicle === t.vehicle && r.specs);
    const agg: Record<string, number> = {};
    for (const { key, col, lo, hi } of SPECS) {
      const vals = found
        .map((r) => r.specs?.[key])
        .filter(
          (v): v is number => typeof v === 'number' && v >= lo && v <= hi,
        );
      if (vals.length) agg[col] = median(vals);
    }
    const haveCount = Object.keys(agg).length;
    if (!agg.gvmKg) {
      console.log(
        `  ⚠ ${t.make} ${t.modelName}: no usable GVM in ${found.length} findings — skipped`,
      );
      noData++;
      continue;
    }
    console.log(
      `  ✓ ${t.make} ${t.modelName}: ${haveCount} specs · GVM ${agg.gvmKg} GCM ${agg.gcmKg ?? '-'} tow ${agg.maxTowingCapacityKg ?? '-'} axle ${agg.frontAxleLimitKg ?? '-'}/${agg.rearAxleLimitKg ?? '-'}`,
    );
    if (!WRITE) continue;

    const makeSlug = slugify(t.make);
    const make = await prisma.vehicleMake.upsert({
      where: { slug: makeSlug },
      update: {},
      create: { name: t.make, slug: makeSlug },
      select: { id: true },
    });
    const model = await prisma.vehicleModel.upsert({
      where: { makeId_slug: { makeId: make.id, slug: t.modelSlug } },
      update: {},
      create: {
        makeId: make.id,
        name: t.modelName,
        slug: t.modelSlug,
        bodyType: t.bodyType,
      },
      select: { id: true },
    });
    const vSlug = `${t.modelSlug}-${t.yearFrom}`;
    const variant = await prisma.vehicleVariant.upsert({
      where: { modelId_slug: { modelId: model.id, slug: vSlug } },
      update: agg, // refresh columns on re-run
      create: {
        model: { connect: { id: model.id } },
        status: 'CATALOGUE',
        yearFrom: t.yearFrom,
        yearTo: t.yearFrom,
        isCurrentProduction: true,
        name: `${t.modelName} ${t.yearFrom}`,
        slug: vSlug,
        market: 'AU',
        ...agg,
      },
      select: { id: true },
    });
    created++;

    for (const [col, value] of Object.entries(agg)) {
      await prisma.variantSpecProvenance.upsert({
        where: { variantId_field: { variantId: variant.id, field: col } },
        update: { value: String(value), status: 'ESTIMATE', asOf: new Date() },
        create: {
          variantId: variant.id,
          field: col,
          value: String(value),
          source: 'CLAUDE' as SpecProvenanceSource,
          status: 'ESTIMATE',
          confidence: 'MEDIUM',
          notes:
            'carsales-gap brochure/PDF extract (docling/qwen) — live but flagged, pending Rule-11 sign-off',
        },
      });
      provRows++;
    }
  }

  console.log(
    WRITE
      ? `\n✓ ${created}/${TARGETS.length} models seeded · ${provRows} provenance rows · ${noData} skipped (no GVM)`
      : `\n${TARGETS.length - noData}/${TARGETS.length} would seed · ${noData} skipped (no usable GVM). (dry-run — pass --write)`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
