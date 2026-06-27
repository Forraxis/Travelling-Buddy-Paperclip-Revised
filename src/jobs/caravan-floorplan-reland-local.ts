/**
 * Land per-FLOORPLAN caravan variants (CATALOGUE_GRANULARITY_PLAN.md milestone 3).
 *
 * Reads ops/n8n/.caravan-catalogue-fp-candidates.jsonl (from caravan-floorplan-recluster.py —
 * the SAME held listings re-keyed on (make, model, year, floorplan)) and lands a CaravanVariant
 * per floorplan, so layouts with materially different weights (e.g. a 4-berth vs 6-berth, or the
 * 17'6"/18'6"/21'6" length variants) stop being merged to one median.
 *
 * SCOPE / SAFETY (Tim's call, 2026-06-25):
 *   • ADDITIVE — never deletes or mutates the existing merged (model-year) variants. New rows use
 *     slug = `${modelSlug}-${year}-${floorplanSlug}`, which can't collide with the old
 *     `${modelSlug}-${year}`. The old merged rows stay until we're happy with the split, then a
 *     separate supersede/cleanup pass removes the ones now covered per-floorplan.
 *   • SPLIT-ONLY (default) — only lands per-floorplan rows for a (make,model,year) that actually
 *     has ≥2 distinct floorplans. Single-floorplan model-years are already correct as the merged
 *     variant, so we don't create redundant duplicates. Lengths ARE distinct floorplans (Tim:
 *     176/186/216 = 17'6"/18'6"/21'6", each with its own weights) → they land separately. Pass
 *     --all to land every floorplan regardless of group size.
 *   • Weight/rich/provenance handling is identical to caravan-listings-land-local.ts (RedBook→
 *     CONFIRMED, dealer corroboration-graded, rich→ESTIMATE). floorplan + berths land to the new
 *     columns + an ESTIMATE provenance row. ALL flagged pending Tim's Rule-11 sign-off.
 *
 * IDEMPOTENT: variant by (modelId, slug); provenance by (variantId, field).
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/caravan-floorplan-reland-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/caravan-floorplan-reland-local.ts --write  # land
 *   …                                                              --all       # every floorplan, not just splits
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
const ALL = process.argv.includes('--all');
const DATA = 'ops/n8n/.caravan-catalogue-fp-candidates.jsonl';

type Quad = {
  atmKg: number | null;
  gtmKg: number | null;
  tareKg: number | null;
  ballKg: number | null;
};

interface Cand {
  make: string;
  model: string;
  year: number;
  floorplan: string | null;
  berths: number | null;
  bodyType: string;
  redbook: Quad;
  dealer: Quad;
  dealerConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'DISPUTED' | null;
  redbookCount: number;
  dealerCount: number;
  bodyLengthMm: number | null;
  overallLengthMm: number | null;
  freshWaterL: number | null;
  greyWaterL: number | null;
  gasBottleConfig: string | null;
  axleConfiguration: string | null;
  listings: number;
  sources: string[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const WEIGHTS: { key: keyof Quad; col: string }[] = [
  { key: 'atmKg', col: 'atmKg' },
  { key: 'gtmKg', col: 'gtmKg' },
  { key: 'tareKg', col: 'tareKg' },
  { key: 'ballKg', col: 'tbmKg' },
];

const RICH: { key: keyof Cand; col: string }[] = [
  { key: 'bodyLengthMm', col: 'bodyLengthMm' },
  { key: 'overallLengthMm', col: 'overallLengthMm' },
  { key: 'freshWaterL', col: 'freshWaterCapacityL' },
  { key: 'greyWaterL', col: 'greyWaterCapacityL' },
  { key: 'gasBottleConfig', col: 'gasBottleConfig' },
];

function dealerGrade(c: Cand['dealerConfidence']): {
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
  return { status: 'ESTIMATE', confidence: 'LOW', promote: false };
}

const VALID_AXLE = new Set([
  'SINGLE_AXLE',
  'DUAL_AXLE_CLOSE_COUPLED',
  'DUAL_AXLE_SPREAD',
  'TRIPLE_AXLE',
]);

async function main() {
  if (!existsSync(DATA))
    throw new Error(
      `${DATA} not found — run ops/caravan-floorplan-recluster.py first.`,
    );
  const all = readFileSync(DATA, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Cand)
    .filter((c) => c.model && c.model !== '(unknown)');

  // Which (make,model,year) groups actually split into ≥2 distinct floorplans?
  const groupFps = new Map<string, Set<string | null>>();
  for (const c of all) {
    const k = `${c.make}|${c.model}|${c.year}`;
    if (!groupFps.has(k)) groupFps.set(k, new Set());
    groupFps.get(k)!.add(c.floorplan);
  }
  const isSplitGroup = (c: Cand) =>
    (groupFps.get(`${c.make}|${c.model}|${c.year}`)?.size ?? 0) >= 2;

  // Land only floorplan-bearing candidates (the null bucket = the existing merged variant).
  // Default: only members of a split group. --all: every floorplan-bearing candidate.
  const cands = all.filter(
    (c) => c.floorplan != null && (ALL || isSplitGroup(c)),
  );

  const withRb = cands.filter((c) =>
    Object.values(c.redbook).some((v) => v != null),
  ).length;
  console.log(
    `\n=== CARAVAN FLOORPLAN RE-LAND (${WRITE ? 'WRITE' : 'dry-run'}, ${ALL ? 'ALL floorplans' : 'split-groups only'}) ===`,
  );
  console.log(
    `  ${all.length} fp-candidates · ${cands.length} to land as per-floorplan variants · ${withRb} carry a RedBook weight`,
  );
  console.log(
    `  (additive — existing merged model-year variants are left untouched)\n`,
  );

  let variants = 0,
    provRows = 0,
    promoted = 0;

  for (const c of cands) {
    if (!WRITE) continue;
    const makeSlug = slugify(c.make);
    const make = await prisma.caravanMake.upsert({
      where: { slug: makeSlug },
      create: { name: c.make, slug: makeSlug, countryOfOrigin: 'Australia' },
      update: {},
    });
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

    const fpSlug = slugify(c.floorplan!);
    const vSlug = `${modelSlug}-${c.year}-${fpSlug}`;
    const primaryAtm = c.redbook.atmKg ?? c.dealer.atmKg ?? 0;
    const axle: AxleConfiguration =
      c.axleConfiguration && VALID_AXLE.has(c.axleConfiguration)
        ? (c.axleConfiguration as AxleConfiguration)
        : primaryAtm >= 2500
          ? 'DUAL_AXLE_CLOSE_COUPLED'
          : 'SINGLE_AXLE';
    const variant = await prisma.caravanVariant.upsert({
      where: { modelId_slug: { modelId: model.id, slug: vSlug } },
      create: {
        modelId: model.id,
        status: 'CATALOGUE',
        yearFrom: c.year,
        yearTo: c.year,
        isCurrentProduction: c.year >= 2025,
        name: `${c.model} ${c.year} (${c.floorplan})`,
        slug: vSlug,
        floorplan: c.floorplan,
        berths: c.berths ?? undefined,
        axleConfiguration: axle,
        market: 'AU',
      },
      update: { floorplan: c.floorplan, berths: c.berths ?? undefined },
    });
    variants += 1;

    const colUpdate: Record<string, number | string> = {};
    const land = async (
      field: string,
      value: number | string,
      status: SpecProvenanceStatus,
      confidence: SpecFieldConfidence | null,
      count: number,
      note: string,
      promote: boolean,
    ) => {
      await prisma.caravanVariantSpecProvenance.upsert({
        where: { variantId_field: { variantId: variant.id, field } },
        create: {
          variantId: variant.id,
          field,
          value: String(value),
          source: 'MANUAL',
          status,
          confidence,
          corroboratingCount: count,
          sourceUrl: c.sources[0] ?? null,
          notes: `${note} — pending Rule-11 sign-off`,
        },
        update: {
          value: String(value),
          status,
          confidence,
          corroboratingCount: count,
          asOf: new Date(),
        },
      });
      provRows += 1;
      if (promote) {
        const cur = (await prisma.caravanVariant.findUnique({
          where: { id: variant.id },
          select: { [field]: true } as never,
        })) as Record<string, unknown> | null;
        if (cur && cur[field] == null) colUpdate[field] = value;
      }
    };

    for (const { key, col } of WEIGHTS) {
      const rb = c.redbook[key];
      const de = c.dealer[key];
      if (rb != null) {
        await land(
          col,
          rb,
          'CONFIRMED',
          'HIGH',
          c.redbookCount,
          'RedBook (manufacturer) figure',
          true,
        );
      } else if (de != null) {
        const g = dealerGrade(c.dealerConfidence);
        await land(
          col,
          de,
          g.status,
          g.confidence,
          c.dealerCount,
          'dealer-listed (as-configured)',
          g.promote,
        );
      }
    }

    for (const { key, col } of RICH) {
      const v = c[key] as number | string | null;
      if (v == null) continue;
      const conf: SpecFieldConfidence = c.listings >= 2 ? 'MEDIUM' : 'LOW';
      await land(
        col,
        v,
        'ESTIMATE',
        conf,
        c.listings,
        'listing-derived spec',
        true,
      );
    }

    // facet provenance (floorplan parsed from the held CCS slug; berths from its leading token)
    await land(
      'floorplan',
      c.floorplan!,
      'ESTIMATE',
      'MEDIUM',
      c.listings,
      'floorplan parsed from CCS slug',
      false,
    );
    if (c.berths != null)
      await land(
        'berths',
        c.berths,
        'ESTIMATE',
        c.listings >= 2 ? 'MEDIUM' : 'LOW',
        c.listings,
        'berths from floorplan/listing',
        false,
      );

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
      `✓ ${variants} per-floorplan variants · ${provRows} provenance rows · ${promoted} columns promoted`,
    );
  } else {
    const splitGroups = [...groupFps.values()].filter(
      (s) => s.size >= 2,
    ).length;
    console.log(
      `would land ${cands.length} per-floorplan variants across ${splitGroups} split model-years ` +
        `(${ALL ? 'plus single-floorplan groups via --all' : 'use --all to also re-land single-floorplan groups'}).`,
    );
    console.log('sample:');
    for (const c of cands.slice(0, 12))
      console.log(
        `  ${slugify(c.make)}-${slugify(c.model)}-${c.year}-${slugify(c.floorplan!)}  ` +
          `ATM ${c.redbook.atmKg ?? c.dealer.atmKg ?? '-'} berths ${c.berths ?? '-'}`,
      );
    console.log('(dry-run — pass --write to land)');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
