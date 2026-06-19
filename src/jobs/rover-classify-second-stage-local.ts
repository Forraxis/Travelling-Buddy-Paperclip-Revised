/**
 * Classify the second-stage type of every second-stage ROVER index row (P2).
 *
 * For each `isSecondStage=true` row, `classifySecondStage` decides whether it's a
 * GVM_UPGRADE / MOTORHOME / CONVERSION / OTHER (factory rows stay NONE). The category
 * bump signal needs the base's FACTORY category, so we first build a base-category map
 * from the clean (non-second-stage) OEM rows keyed by baseMake + baseModel.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-classify-second-stage-local.ts
 *
 * Idempotent — re-run any time (after a new crawl / re-normalize). LOCAL only.
 */
import { prisma } from '../lib/db';
import {
  classifySecondStage,
  type SecondStageType,
} from '../lib/spec-fetch/rover/second-stage';

function baseKey(make: string | null, model: string | null): string {
  return `${(make ?? '').toLowerCase()}|||${(model ?? '').toLowerCase()}`;
}

async function main() {
  const rows = await prisma.roverApprovalIndex.findMany({
    select: {
      id: true,
      make: true,
      model: true,
      modifier: true,
      category: true,
      baseMake: true,
      baseModel: true,
      isSecondStage: true,
      raw: true,
    },
  });

  // Build base factory category map from the clean OEM (non-second-stage) rows.
  // When a base make/model spans several categories we keep the LOWEST (factory)
  // rank so a genuine uprate still reads as a bump.
  const CAT_RANK: Record<string, number> = { NA: 1, NB1: 2, NB2: 3, NC: 4 };
  const baseCategory = new Map<string, string>();
  for (const r of rows) {
    if (r.isSecondStage || !r.category) continue;
    const key = baseKey(r.baseMake, r.baseModel);
    const existing = baseCategory.get(key);
    if (
      !existing ||
      (CAT_RANK[r.category.toUpperCase()] ?? 99) <
        (CAT_RANK[existing.toUpperCase()] ?? 99)
    ) {
      baseCategory.set(key, r.category);
    }
  }

  const histogram: Record<SecondStageType, number> = {
    NONE: 0,
    GVM_UPGRADE: 0,
    CONVERSION: 0,
    MOTORHOME: 0,
    OTHER: 0,
  };
  let secondStageCount = 0;

  for (const r of rows) {
    const type = classifySecondStage({
      isSecondStage: r.isSecondStage,
      make: r.make,
      model: r.model,
      modifier: r.modifier,
      category: r.category,
      baseCategory: baseCategory.get(baseKey(r.baseMake, r.baseModel)) ?? null,
      raw: (r.raw as Record<string, unknown> | null) ?? null,
    });
    histogram[type] += 1;
    if (r.isSecondStage) secondStageCount += 1;
    await prisma.roverApprovalIndex.update({
      where: { id: r.id },
      data: { secondStageType: type },
    });
  }

  console.log(
    `classified ${rows.length} rows (${secondStageCount} second-stage):`,
  );
  const order: SecondStageType[] = [
    'GVM_UPGRADE',
    'MOTORHOME',
    'CONVERSION',
    'OTHER',
    'NONE',
  ];
  for (const t of order) {
    console.log(`  ${t.padEnd(12)} ${histogram[t]}`);
  }

  // Spot-check a few GVM-upgrade rows so the write is visible.
  const gvm = await prisma.roverApprovalIndex.findMany({
    where: { secondStageType: 'GVM_UPGRADE' },
    select: { make: true, model: true, category: true, baseMake: true },
    take: 6,
  });
  console.log('GVM_UPGRADE sample:');
  for (const g of gvm) {
    console.log(
      `  ${g.make} | ${g.model} | ${g.category} | base=${g.baseMake}`,
    );
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
