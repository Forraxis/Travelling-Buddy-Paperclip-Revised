/**
 * RVD spec sweep — harvest every spec we already hold. [task #6/#11]
 *
 * We have 6,467 Road Vehicle Descriptors with full `rawText` already extracted in
 * `RoverDocument` (no fetch, no egress). The deterministic `parseRvdText` pulls the
 * complete per-variant figure set ROVER publishes — GVM, tare, GCM, braked +
 * non-braked towing, length/width/height/wheelbase/clearance, seating, body, axle
 * code — plus document-level make/model/category/date. This job runs that over every
 * stored doc and writes the structured result into `RoverDocument.parsed` (jsonb) so
 * we have a solid, queryable vehicle-spec dataset to come back to.
 *
 * It ALSO adds broader axle-rating extraction: front/rear axle limits appear in the
 * Remarks in many free-text formats the strict parser regex misses
 * ("Front axle rating: 705 kg", "SSM front axle capacity = 1620kg", "re-rated to
 * 1,550 kg") — "front axle" occurs in 1,667 docs but only ~15 match the strict
 * pattern. The looser patterns here (with a kg boundary + sane 400–6000 kg range, and
 * "lifter"/feature mentions excluded) recover far more, deterministically and free.
 *
 * Nothing here touches the live catalogue or trust tiers — it's a raw-data archive in
 * `RoverDocument.parsed`. Promotion to VehicleVariant / VariantSpecProvenance (with
 * the proper per-variant mapping + Rule-11 gating) is a deliberate later step.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/rvd-sweep-local.ts          # dry-run: coverage report only
 *   DATABASE_URL=… npx tsx src/jobs/rvd-sweep-local.ts --write  # write parsed jsonb back
 *
 * Idempotent — re-run any time (re-parses from rawText; overwrites parsed).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { parseRvdText } from '../lib/spec-fetch/rover/rvd-parser';

const WRITE = process.argv.includes('--write');

/** Broader axle-rating extraction over the whole doc text. Captures the common
 * free-text phrasings; requires a `kg` unit and a plausible 400–6000 kg value so
 * feature mentions ("front axle lifter up to 40 mm") can't false-match. Returns the
 * first plausible value (document-level, like the existing remarks figure). */
function axleRating(text: string, side: 'front' | 'rear'): number | null {
  const w = side;
  const patterns = [
    new RegExp(`${w} axle:\\s*([\\d,]{3,})\\s*kg`, 'i'),
    new RegExp(`${w} axle rating[^0-9]{0,12}([\\d,]{3,})\\s*kg`, 'i'),
    new RegExp(`${w} axle capacity[^0-9]{0,8}([\\d,]{3,})\\s*kg`, 'i'),
    new RegExp(`${w} axle[^0-9]{0,6}re-?rated to\\s*([\\d,]{3,})\\s*kg`, 'i'),
    new RegExp(`${w} axle[^.\\n]{0,18}?([\\d,]{3,})\\s*kg`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = parseInt(m[1].replace(/,/g, ''), 10);
    if (Number.isFinite(n) && n >= 400 && n <= 6000) return n;
  }
  return null;
}

interface Cov {
  docs: number;
  variants: number;
  gvm: number;
  gcm: number;
  tare: number;
  towBraked: number;
  wheelbase: number;
  length: number;
  axleFront: number;
  axleRear: number;
  axleNewlyFound: number; // axle the broad patterns got that the strict parser didn't
}

async function main() {
  const docs = await prisma.roverDocument.findMany({
    select: { id: true, rawText: true },
  });

  const cov: Cov = {
    docs: 0,
    variants: 0,
    gvm: 0,
    gcm: 0,
    tare: 0,
    towBraked: 0,
    wheelbase: 0,
    length: 0,
    axleFront: 0,
    axleRear: 0,
    axleNewlyFound: 0,
  };
  const samples: string[] = [];

  for (const d of docs) {
    if (!d.rawText) continue;
    cov.docs += 1;
    const parsed = parseRvdText(d.rawText);

    const frontAxleKg =
      parsed.remarksFrontAxleKg ?? axleRating(d.rawText, 'front');
    const rearAxleKg =
      parsed.remarksRearAxleKg ?? axleRating(d.rawText, 'rear');
    if (frontAxleKg) cov.axleFront += 1;
    if (rearAxleKg) cov.axleRear += 1;
    if (
      (frontAxleKg || rearAxleKg) &&
      !parsed.remarksFrontAxleKg &&
      !parsed.remarksRearAxleKg
    ) {
      cov.axleNewlyFound += 1;
      if (samples.length < 12) {
        samples.push(
          `${parsed.make ?? '?'} ${parsed.model ?? '?'} (${parsed.vtaNumber}): front=${frontAxleKg ?? '—'} rear=${rearAxleKg ?? '—'}`,
        );
      }
    }

    for (const v of parsed.variants) {
      cov.variants += 1;
      if (v.gvmKg) cov.gvm += 1;
      if (v.gcmKg) cov.gcm += 1;
      if (v.tareKg) cov.tare += 1;
      if (v.towBrakedKg) cov.towBraked += 1;
      if (v.wheelbaseMm) cov.wheelbase += 1;
      if (v.lengthMm) cov.length += 1;
    }

    if (WRITE) {
      await prisma.roverDocument.update({
        where: { id: d.id },
        data: {
          variantCount: parsed.variants.length,
          parsed: {
            make: parsed.make,
            model: parsed.model,
            marketingDesignation: parsed.marketingDesignation,
            categoryBroad: parsed.categoryBroad,
            generatedDate: parsed.generatedDate,
            frontAxleKg,
            rearAxleKg,
            variants: parsed.variants,
          } as unknown as Prisma.InputJsonObject,
        },
      });
    }
  }

  const pct = (n: number, d: number) =>
    d > 0 ? `${((100 * n) / d).toFixed(0)}%` : '—';
  console.log(`\n=== RVD SWEEP (${WRITE ? 'WRITE' : 'dry-run'}) ===`);
  console.log(`docs parsed: ${cov.docs}   variants: ${cov.variants}\n`);
  console.log(`Per-variant coverage:`);
  console.log(`  GVM:        ${cov.gvm} (${pct(cov.gvm, cov.variants)})`);
  console.log(`  GCM:        ${cov.gcm} (${pct(cov.gcm, cov.variants)})`);
  console.log(`  Tare:       ${cov.tare} (${pct(cov.tare, cov.variants)})`);
  console.log(
    `  Tow braked: ${cov.towBraked} (${pct(cov.towBraked, cov.variants)})`,
  );
  console.log(
    `  Wheelbase:  ${cov.wheelbase} (${pct(cov.wheelbase, cov.variants)})`,
  );
  console.log(`  Length:     ${cov.length} (${pct(cov.length, cov.variants)})`);
  console.log(`\nDocument-level AXLE ratings (the gap we care about):`);
  console.log(`  front axle: ${cov.axleFront} docs`);
  console.log(`  rear axle:  ${cov.axleRear} docs`);
  console.log(
    `  └ recovered by broad patterns beyond the strict regex: ${cov.axleNewlyFound} docs`,
  );
  if (samples.length) {
    console.log(`\n  sample broad-pattern axle finds:`);
    for (const s of samples) console.log(`    ${s}`);
  }
  if (!WRITE) console.log(`\n(dry-run — pass --write to store parsed jsonb)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
