/**
 * Load the harvested Jayco caravan dataset into CaravanMake/Model/Variant. [caravan catalogue seed]
 *
 * Reads ops/n8n/.jayco-caravans.jsonl (from caravan-jayco-harvest-local.ts) and seeds the
 * (empty) caravan catalogue: 1 CaravanMake (Jayco) → CaravanModels (one per range+trim, with
 * body type) → CaravanVariants (one per floorplan).
 *
 * What this DOES populate: tare, tow-ball mass, body/overall length, water, gas, axle config
 * (the latter is an ESTIMATE/guess — see harvest notes). What it does NOT: atmKg, gtmKg and
 * couplingToAxleMm / axleSpacingMm are left null — they're not on the Jayco web payload and are
 * the deliberate next data step (RVSA / gated PDF / plate). So the caravan TOWING VERDICT is not
 * computable from this seed alone; this is the catalogue/identity foundation to build those onto.
 *
 * Idempotent: upserts make/model by slug, variants by (model, slug). Re-runnable.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/caravan-jayco-load-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/caravan-jayco-load-local.ts --write  # load
 */
import { readFileSync, existsSync } from 'node:fs';
import type { AxleConfiguration, CaravanBodyType } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.jayco-caravans.jsonl';

interface Rec {
  make: string;
  modelRange: string;
  model: string;
  trim: string | null;
  bodyType: string;
  name: string; // SKU, e.g. "21.65-3.SL-MY26" / "LARK.CP-MY26"
  yearFrom: number;
  atmKg: number | null;
  gtmKg: number | null;
  tareKg: number | null;
  tbmKg: number | null;
  axleConfiguration: string;
  bodyLengthMm: number | null;
  overallLengthMm: number | null;
  freshWaterCapacityL: number | null;
  greyWaterCapacityL: number | null;
  gasBottleConfig: string | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Human floorplan label from the SKU: leading numeric code (e.g. "21.65-3"), else the range. */
function floorplanName(rec: Rec): string {
  const s = rec.name.replace(/-MY\d+$/i, '');
  const m = s.match(/^(\d+\.\d+(?:-\d+)?)/);
  return m ? m[1] : rec.modelRange;
}

async function main() {
  if (!existsSync(DATA)) throw new Error(`${DATA} not found`);
  const recs = readFileSync(DATA, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Rec);

  console.log(
    `\n=== JAYCO CARAVAN LOAD (${WRITE ? 'WRITE' : 'dry-run'}) · ${recs.length} floorplans ===\n`,
  );

  // Group by model (range+trim) → its body type + variant records.
  const models = new Map<string, { name: string; bodyType: string; recs: Rec[] }>();
  for (const r of recs) {
    const key = r.model;
    const e = models.get(key) ?? { name: r.model, bodyType: r.bodyType, recs: [] };
    e.recs.push(r);
    models.set(key, e);
  }

  const bodyTypeCount: Record<string, number> = {};
  for (const r of recs) bodyTypeCount[r.bodyType] = (bodyTypeCount[r.bodyType] ?? 0) + 1;

  console.log(`make: Jayco · models: ${models.size} · variants: ${recs.length}`);
  console.log(
    `body types: ${Object.entries(bodyTypeCount).map(([b, n]) => `${b} ${n}`).join(' · ')}`,
  );
  console.log(
    `atm/gtm/coupling: all null (next data step) · tare ${recs.filter((r) => r.tareKg).length}/${recs.length} · tbm ${recs.filter((r) => r.tbmKg).length}/${recs.length}\n`,
  );

  const samples: string[] = [];
  for (const [, m] of models) {
    if (samples.length >= 6) break;
    const r = m.recs[0];
    samples.push(
      `  ${m.name} [${m.bodyType}] — ${m.recs.length} floorplan(s), e.g. "${floorplanName(r)}" tare ${r.tareKg} ball ${r.tbmKg} len ${r.overallLengthMm}`,
    );
  }
  console.log('sample models:');
  for (const s of samples) console.log(s);

  if (!WRITE) {
    console.log('\n(dry-run — pass --write to load)');
    await prisma.$disconnect();
    return;
  }

  // ---- write ----
  const make = await prisma.caravanMake.upsert({
    where: { slug: 'jayco' },
    create: { name: 'Jayco', slug: 'jayco', countryOfOrigin: 'Australia' },
    update: {},
  });

  let modelsWritten = 0;
  let variantsWritten = 0;
  for (const [, m] of models) {
    const modelSlug = slugify(m.name);
    const model = await prisma.caravanModel.upsert({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
      create: {
        makeId: make.id,
        name: m.name,
        slug: modelSlug,
        bodyType: m.bodyType as CaravanBodyType,
      },
      update: { name: m.name, bodyType: m.bodyType as CaravanBodyType },
    });
    modelsWritten += 1;

    const usedSlugs = new Set<string>();
    const usedNames = new Set<string>();
    for (const r of m.recs) {
      // slug from the (unique) SKU guarantees per-model uniqueness; name is the readable label.
      let slug = slugify(r.name.replace(/-MY\d+$/i, ''));
      while (usedSlugs.has(slug)) slug = `${slug}-x`;
      usedSlugs.add(slug);

      // Name must be unique within the model (exclusion constraint is on modelId+name+years).
      // On collision, pull the qualifier segment out of the SKU (e.g. "24.75-6.4T.BS" → "4T").
      let vName = floorplanName(r);
      if (usedNames.has(vName)) {
        const qual = r.name
          .replace(/-MY\d+$/i, '')
          .replace(/^\d+\.\d+(?:-\d+)?\.?/, '')
          .replace(/\.[A-Za-z0-9]{2}$/, '');
        vName = qual ? `${vName} ${qual}` : `${vName} 2`;
        while (usedNames.has(vName)) vName = `${vName}-x`;
      }
      usedNames.add(vName);

      await prisma.caravanVariant.upsert({
        where: { modelId_slug: { modelId: model.id, slug } },
        create: {
          modelId: model.id,
          status: 'CATALOGUE',
          yearFrom: r.yearFrom,
          yearTo: r.yearFrom, // single model year (MY); open-ended handled by isCurrentProduction
          isCurrentProduction: r.yearFrom >= 2026,
          name: vName,
          slug,
          atmKg: r.atmKg,
          gtmKg: r.gtmKg,
          tareKg: r.tareKg,
          tbmKg: r.tbmKg,
          axleConfiguration: r.axleConfiguration as AxleConfiguration,
          bodyLengthMm: r.bodyLengthMm,
          overallLengthMm: r.overallLengthMm,
          freshWaterCapacityL: r.freshWaterCapacityL,
          greyWaterCapacityL: r.greyWaterCapacityL,
          gasBottleConfig: r.gasBottleConfig,
          market: 'AU',
        },
        update: {
          name: vName,
          tareKg: r.tareKg,
          tbmKg: r.tbmKg,
          axleConfiguration: r.axleConfiguration as AxleConfiguration,
          bodyLengthMm: r.bodyLengthMm,
          overallLengthMm: r.overallLengthMm,
          freshWaterCapacityL: r.freshWaterCapacityL,
          gasBottleConfig: r.gasBottleConfig,
        },
      });
      variantsWritten += 1;
    }
  }

  console.log(
    `\n✓ loaded 1 make · ${modelsWritten} models · ${variantsWritten} variants`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
