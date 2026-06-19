/**
 * Re-apply the baseModel cleanup over the ROVER skeleton index (P3).
 *
 * `cleanBaseModel` strips trim/drive/SSM/GVM/body noise from the applicant model
 * free text ("Hilux AN2 SSM 4x4" → "Hilux") so the hub groups by the real base
 * model. This runner re-derives `baseModel` for every RoverApprovalIndex row from
 * the existing `model` column — it does NOT re-run make resolution, so `baseMake`,
 * `modifier`, `isSecondStage` and `normalizationStatus` are left untouched.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-clean-base-model-local.ts
 *
 * Idempotent — re-run any time (e.g. after tuning the noise lists or a new crawl).
 */
import { prisma } from '../lib/db';
import { cleanBaseModel } from '../lib/spec-fetch/rover/normalize';

async function main() {
  const rows = await prisma.roverApprovalIndex.findMany({
    select: { id: true, model: true, baseModel: true },
  });

  let changed = 0;
  let unchanged = 0;
  const examples: { from: string; to: string }[] = [];

  for (const r of rows) {
    const next = cleanBaseModel(r.model);
    if (next === r.baseModel) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    if (examples.length < 15 && r.model && next) {
      examples.push({ from: r.model, to: next });
    }
    await prisma.roverApprovalIndex.update({
      where: { id: r.id },
      data: { baseModel: next },
    });
  }

  console.log(
    `cleaned baseModel on ${rows.length} rows: ${changed} changed / ${unchanged} unchanged`,
  );
  if (examples.length) {
    console.log('sample rewrites:');
    for (const e of examples) {
      console.log(`  ${JSON.stringify(e.from)} → ${JSON.stringify(e.to)}`);
    }
  }

  // Distinct baseModel count is a quick proxy for grouping quality.
  const distinct = await prisma.roverApprovalIndex.findMany({
    select: { baseModel: true },
    where: { baseModel: { not: null } },
    distinct: ['baseModel'],
  });
  console.log(`distinct baseModel values: ${distinct.length}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
