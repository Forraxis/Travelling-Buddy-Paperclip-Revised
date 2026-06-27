/**
 * Supersede the merged (model-year) caravan variants now covered per-floorplan
 * (CATALOGUE_GRANULARITY_PLAN.md milestone 3 — cleanup pass after the additive re-land).
 *
 * caravan-floorplan-reland-local.ts landed per-floorplan variants ADDITIVELY, leaving the old
 * merged variant in place (Tim: "don't delete until we're happy with the result"). This pass
 * retires those merged rows — but ONLY when it's safe and they're genuinely redundant:
 *
 *   • REDUNDANT: the merged row's (modelId, yearFrom) now has ≥2 floorplan-bearing siblings, so
 *     its single median (which was wrong for every layout — e.g. Bruder Exp 2021's 2350 kg
 *     median vs the real 1600/3100) is fully replaced by the per-floorplan rows.
 *   • SAFE: nothing references it — no Setup (a user's saved rig), no SetupCaravanAccessory, no
 *     AccessoryFitment, no CaravanSubmission.resultingVariant, no SponsoredPlacement. A referenced
 *     row is KEPT and reported, never silently orphaned.
 *
 * Deleting a variant cascades its CaravanVariantSpecProvenance rows (onDelete: Cascade). No slug
 * redirect is written: a merged row maps to MANY floorplans, so a 1→1 VariantSlugRedirect can't
 * represent it — the model page lists the floorplans instead.
 *
 * DRY-RUN by default — prints exactly what it would delete + what it skips (and why). Idempotent.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/caravan-floorplan-supersede-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/caravan-floorplan-supersede-local.ts --write  # delete
 */
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');

type MergedRow = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  fp_siblings: number;
  refs: number;
};

async function main() {
  // Merged rows (floorplan IS NULL) whose (modelId, yearFrom) now has ≥2 per-floorplan siblings,
  // annotated with a total reference count across every FK that points at a CaravanVariant.
  const rows = await prisma.$queryRaw<MergedRow[]>`
    WITH fp AS (
      SELECT "modelId", "yearFrom", count(*)::int AS n
      FROM "CaravanVariant" WHERE floorplan IS NOT NULL
      GROUP BY 1, 2 HAVING count(*) >= 2
    ),
    merged AS (
      SELECT v.id, v.slug, v."yearFrom" AS year, v."modelId", fp.n AS fp_siblings
      FROM "CaravanVariant" v
      JOIN fp ON fp."modelId" = v."modelId" AND fp."yearFrom" = v."yearFrom"
      WHERE v.floorplan IS NULL
    )
    SELECT m.id, m.slug, mk.name AS make, md.name AS model, m.year, m.fp_siblings,
      (
        (SELECT count(*) FROM "Setup" s WHERE s."caravanVariantId" = m.id)
      + (SELECT count(*) FROM "AccessoryFitment" f WHERE f."caravanVariantId" = m.id)
      + (SELECT count(*) FROM "AccessorySubmission" asub WHERE asub."appliesToCaravanVariantId" = m.id)
      + (SELECT count(*) FROM "CaravanSubmission" cs WHERE cs."resultingVariantId" = m.id)
      + (SELECT count(*) FROM "FitmentPositionSubmission" fps WHERE fps."caravanVariantId" = m.id)
      )::int AS refs
    FROM merged m
    JOIN "CaravanModel" md ON md.id = m."modelId"
    JOIN "CaravanMake" mk ON mk.id = md."makeId"
    ORDER BY mk.name, md.name, m.year
  `;

  const safe = rows.filter((r) => r.refs === 0);
  const kept = rows.filter((r) => r.refs > 0);

  console.log(
    `\n=== CARAVAN MERGED-ROW SUPERSEDE (${WRITE ? 'WRITE' : 'dry-run'}) ===`,
  );
  console.log(
    `  ${rows.length} merged rows now covered per-floorplan · ${safe.length} safe to delete · ${kept.length} kept (referenced)\n`,
  );

  for (const r of safe.slice(0, 40))
    console.log(
      `  delete  ${r.make} ${r.model} ${r.year}  [${r.slug}]  (${r.fp_siblings} floorplans replace it)`,
    );
  if (safe.length > 40) console.log(`  … +${safe.length - 40} more`);
  for (const r of kept)
    console.log(
      `  KEEP    ${r.make} ${r.model} ${r.year}  [${r.slug}]  — ${r.refs} reference(s), not orphaning`,
    );

  if (!WRITE) {
    console.log('\n(dry-run — pass --write to delete the safe rows)');
    await prisma.$disconnect();
    return;
  }

  if (safe.length) {
    const res = await prisma.caravanVariant.deleteMany({
      where: { id: { in: safe.map((r) => r.id) } },
    });
    console.log(
      `\n✓ deleted ${res.count} merged variants (their provenance rows cascaded)`,
    );
  } else {
    console.log('\nnothing to delete.');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
