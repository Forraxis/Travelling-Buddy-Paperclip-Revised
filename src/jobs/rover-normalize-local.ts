/**
 * Normalize the ROVER skeleton index — resolve base make/model + second-stage modifier
 * for every RoverApprovalIndex row (VEHICLE_DATA_HUB.md §3.5). Self-bootstrapping: learns
 * a model→make map from the clean OEM rows, then applies it to the messy ones.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-normalize-local.ts
 *
 * Idempotent — re-run any time (e.g. after a new crawl). Rows that resolve land AUTO;
 * the ambiguous tail lands NEEDS_REVIEW for AI/admin later.
 */
import { prisma } from '../lib/db';
import { RoverMakeNormalizer } from '../lib/spec-fetch/rover/normalize';

async function main() {
  const rows = await prisma.roverApprovalIndex.findMany({
    select: { id: true, make: true, model: true },
  });

  const normalizer = new RoverMakeNormalizer();
  normalizer.learnFrom(rows);

  let auto = 0;
  let needsReview = 0;
  let secondStage = 0;
  for (const r of rows) {
    const n = normalizer.normalize(r.make, r.model);
    if (n.status === 'AUTO') auto += 1;
    else needsReview += 1;
    if (n.isSecondStage) secondStage += 1;
    await prisma.roverApprovalIndex.update({
      where: { id: r.id },
      data: {
        baseMake: n.baseMake,
        baseModel: n.baseModel,
        modifier: n.modifier,
        isSecondStage: n.isSecondStage,
        normalizationStatus: n.status,
      },
    });
  }

  const topMakes = await prisma.roverApprovalIndex.groupBy({
    by: ['baseMake'],
    _count: true,
    where: { baseMake: { not: null } },
    orderBy: { _count: { baseMake: 'desc' } },
    take: 12,
  });

  console.log(
    `normalized ${rows.length}: ${auto} AUTO / ${needsReview} NEEDS_REVIEW · ${secondStage} second-stage`,
  );
  console.log(
    'top base makes:',
    topMakes.map((m) => `${m.baseMake}:${m._count}`).join(' '),
  );

  // Spot-check the Premcar Navara case.
  const premcar = await prisma.roverApprovalIndex.findFirst({
    where: { make: { equals: 'PREMCAR', mode: 'insensitive' } },
    select: {
      vtaNumber: true,
      make: true,
      model: true,
      baseMake: true,
      baseModel: true,
      modifier: true,
      isSecondStage: true,
    },
  });
  if (premcar) console.log('Premcar row →', JSON.stringify(premcar));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
