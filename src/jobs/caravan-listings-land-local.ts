/**
 * Land the aggregated caravan-listing candidates into the catalogue + provenance. [caravan ATM/GTM]
 *
 * Reads ops/n8n/.caravan-catalogue-candidates.jsonl (make/model/year/bodyType + median
 * ATM/GTM/Tare + confidence + listing count, from caravan-listings-aggregate.py) and writes:
 *   - CaravanMake / CaravanModel / CaravanVariant rows (identity), and
 *   - CaravanVariantSpecProvenance rows (atm/gtm/tare) carrying source + status + confidence +
 *     corroboratingCount + sourceUrl — the caravan mirror of the vehicle provenance system.
 *
 * Confidence → status: HIGH (>=2 agreeing listings) → CONFIRMED; MEDIUM (single sane) → ESTIMATE;
 * LOW → ESTIMATE; DISPUTED (listings disagree) → DISPUTED. source=MANUAL (scraped/aggregated).
 *
 * Column promotion (so the calculator can compute): the median value is also written to the
 * CaravanVariant column ONLY for HIGH+MEDIUM. LOW/DISPUTED stay provenance-only (no column) —
 * same safety policy as vehicles: a weak/conflicting compliance limit never feeds the verdict,
 * it stays a flagged estimate that drives "help us verify". Non-clobbering (never overwrites a
 * column already set, e.g. the Jayco manufacturer seed).
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/caravan-listings-land-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/caravan-listings-land-local.ts --write  # land
 */
import { readFileSync, existsSync } from 'node:fs';
import type {
  AxleConfiguration,
  CaravanBodyType,
  SpecFieldConfidence,
  SpecProvenanceStatus,
} from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.caravan-catalogue-candidates.jsonl';

interface Cand {
  make: string;
  model: string;
  year: number;
  bodyType: string;
  atmKg: number;
  gtmKg: number | null;
  tareKg: number | null;
  listings: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'DISPUTED';
  sources: string[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** confidence → (provenance status, confidence enum, promote-to-column?) */
function grade(c: Cand['confidence']): {
  status: SpecProvenanceStatus;
  confidence: SpecFieldConfidence | null;
  promote: boolean;
} {
  if (c === 'HIGH')
    return { status: 'CONFIRMED', confidence: 'HIGH', promote: true };
  if (c === 'MEDIUM')
    return { status: 'ESTIMATE', confidence: 'MEDIUM', promote: true };
  if (c === 'DISPUTED')
    return { status: 'DISPUTED', confidence: 'LOW', promote: false };
  return { status: 'ESTIMATE', confidence: 'LOW', promote: false }; // LOW
}

async function main() {
  if (!existsSync(DATA))
    throw new Error(`${DATA} not found — run the aggregate first.`);
  const cands = readFileSync(DATA, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cand)
    .filter((c) => c.model && c.model !== '(unknown)');

  const conf = cands.reduce<Record<string, number>>((a, c) => {
    a[c.confidence] = (a[c.confidence] ?? 0) + 1;
    return a;
  }, {});
  console.log(
    `\n=== CARAVAN LISTINGS LAND (${WRITE ? 'WRITE' : 'dry-run'}) · ${cands.length} candidates ===`,
  );
  console.log(`confidence: ${JSON.stringify(conf)}\n`);

  let makes = 0,
    models = 0,
    variants = 0,
    provRows = 0,
    promoted = 0;
  const seenMake = new Set<string>();
  const seenModel = new Set<string>();

  for (const c of cands) {
    if (!WRITE) continue;
    // --- make ---
    const makeSlug = slugify(c.make);
    const make = await prisma.caravanMake.upsert({
      where: { slug: makeSlug },
      create: { name: c.make, slug: makeSlug, countryOfOrigin: 'Australia' },
      update: {},
    });
    if (!seenMake.has(makeSlug)) {
      seenMake.add(makeSlug);
      makes += 1;
    }
    // --- model ---
    const modelSlug = slugify(c.model);
    const model = await prisma.caravanModel.upsert({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
      create: {
        makeId: make.id,
        name: c.model,
        slug: modelSlug,
        bodyType: c.bodyType as CaravanBodyType,
      },
      update: {},
    });
    if (!seenModel.has(`${makeSlug}/${modelSlug}`)) {
      seenModel.add(`${makeSlug}/${modelSlug}`);
      models += 1;
    }
    // --- variant (one per model-year) ---
    const vSlug = `${modelSlug}-${c.year}`;
    const axle: AxleConfiguration =
      c.atmKg >= 2500 ? 'DUAL_AXLE_CLOSE_COUPLED' : 'SINGLE_AXLE';
    const variant = await prisma.caravanVariant.upsert({
      where: { modelId_slug: { modelId: model.id, slug: vSlug } },
      create: {
        modelId: model.id,
        status: 'CATALOGUE',
        yearFrom: c.year,
        yearTo: c.year,
        isCurrentProduction: c.year >= 2025,
        name: `${c.model} ${c.year}`,
        slug: vSlug,
        axleConfiguration: axle,
        market: 'AU',
      },
      update: {},
    });
    variants += 1;

    // --- provenance + (gated) column promotion ---
    const g = grade(c.confidence);
    const fields: [string, number | null][] = [
      ['atmKg', c.atmKg],
      ['gtmKg', c.gtmKg],
      ['tareKg', c.tareKg],
    ];
    const colUpdate: Record<string, number> = {};
    for (const [field, value] of fields) {
      if (value == null) continue;
      await prisma.caravanVariantSpecProvenance.upsert({
        where: { variantId_field: { variantId: variant.id, field } },
        create: {
          variantId: variant.id,
          field,
          value: String(value),
          source: 'MANUAL',
          status: g.status,
          confidence: g.confidence,
          corroboratingCount: c.listings,
          sourceUrl: c.sources[0] ?? null,
          notes:
            'caravan-listings aggregate (caravanking) — pending Rule-11 sign-off',
        },
        update: {
          value: String(value),
          status: g.status,
          confidence: g.confidence,
          corroboratingCount: c.listings,
          asOf: new Date(),
        },
      });
      provRows += 1;
      // promote to column only for HIGH/MEDIUM, and only if the column is still null
      if (g.promote) {
        const cur = (await prisma.caravanVariant.findUnique({
          where: { id: variant.id },
          select: { [field]: true } as never,
        })) as Record<string, number | null> | null;
        if (cur && cur[field] == null) {
          colUpdate[field] = value;
        }
      }
    }
    if (Object.keys(colUpdate).length) {
      await prisma.caravanVariant.update({
        where: { id: variant.id },
        data: colUpdate,
      });
      promoted += Object.keys(colUpdate).length;
    }
  }

  if (WRITE) {
    console.log(
      `✓ ${makes} makes · ${models} models · ${variants} variants · ${provRows} provenance rows · ${promoted} columns promoted (HIGH+MEDIUM)`,
    );
  } else {
    const promoteable = cands.filter(
      (c) => c.confidence === 'HIGH' || c.confidence === 'MEDIUM',
    ).length;
    console.log(
      `would create ~${new Set(cands.map((c) => slugify(c.make))).size} makes · ` +
        `~${new Set(cands.map((c) => `${slugify(c.make)}/${slugify(c.model)}`)).size} models · ` +
        `${cands.length} variants · ${promoteable} with HIGH/MEDIUM columns promoted ` +
        `(${cands.length - promoteable} LOW/DISPUTED stay provenance-only)`,
    );
    console.log('(dry-run — pass --write to land)');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
