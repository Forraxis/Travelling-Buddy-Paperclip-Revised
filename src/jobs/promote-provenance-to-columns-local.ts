/**
 * Promote landed spec ESTIMATEs from VariantSpecProvenance into the matching
 * VehicleVariant *columns*, so the calculator can actually compute. [spec bridge]
 *
 * WHY: the calculator reads the VehicleVariant numeric COLUMNS (gvmKg, axle limits,
 * overhangs, …) to run its axle/overhang/TBM CoG-beam maths. But our ~795 landed
 * axle values + the GCM/towing/overhang estimates currently live ONLY as
 * VariantSpecProvenance rows (source=MANUAL/CLAUDE, status=ESTIMATE) — the columns
 * are still NULL — so the calculator can't see them. This job copies each landed
 * provenance value into its column, bridging the gap.
 *
 * The provenance row REMAINS the trust record: this only mirrors the *number* into
 * the column; status/confidence on the provenance row still gate how the value is
 * displayed (ESTIMATE vs CONFIRMED, HIGH/MEDIUM/LOW grade, "help us verify" CTA).
 * Promoting a value into a column does NOT promote its trust — it just lets the
 * physics run on the best number we have.
 *
 * NON-DESTRUCTIVE: a column is written ONLY where it is currently NULL. Columns
 * already populated by ROVER/QLD (authoritative identity-spine data) are NEVER
 * overwritten — those rows win, regardless of what provenance says.
 *
 * CONFIDENCE POLICY: by default LOW-confidence values are NOT promoted. A LOW value
 * is our weakest signal (single foreign/aggregator source, no OEM, no corroboration);
 * for a compliance LIMIT a wrong-high number is dangerous, and a disclaimer doesn't
 * undo the anchoring of a concrete figure. So LOW values stay out of the physics
 * columns (no verdict is computed) — but they REMAIN in provenance, so the UI can
 * still surface "unverified estimate exists → help us confirm from your placard"
 * (safer by construction + drives the plate-verify flywheel). `--include-low` overrides.
 *
 * Field set: only the numeric column fields the calculator reads. Provenance fields
 * with no matching column (e.g. fuelType) are skipped. Values are strings in
 * provenance; non-numeric multi-spec strings ("6350/6400") are skipped + logged.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/promote-provenance-to-columns-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/promote-provenance-to-columns-local.ts --write  # persist (HIGH+MEDIUM)
 *   DATABASE_URL=… npx tsx src/jobs/promote-provenance-to-columns-local.ts --write --include-low
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
/** Override the default — also promote LOW-confidence values into the columns. */
const INCLUDE_LOW = process.argv.includes('--include-low');

/**
 * The numeric VehicleVariant columns the calculator reads. A provenance.field only
 * promotes if its name is in this set (1:1 with the column name); anything else
 * (fuelType, maxRoofLoadKg, etc.) has no calculator column here and is skipped.
 */
const COLUMN_FIELDS = [
  'gvmKg',
  'gcmKg',
  'kerbWeightKg',
  'maxTowingCapacityKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'wheelbaseMm',
  'frontOverhangMm',
  'rearOverhangMm',
  'totalLengthMm',
  'maxTowBallDownloadKg',
] as const;

type ColumnField = (typeof COLUMN_FIELDS)[number];
const isColumnField = (f: string): f is ColumnField =>
  (COLUMN_FIELDS as readonly string[]).includes(f);

/** provenance.value → integer, or null if blank / non-numeric (e.g. "6350/6400"). */
function parseIntValue(value: string | null): number | null {
  if (value == null) return null;
  const s = value.trim();
  if (!/^\d+$/.test(s)) return null; // strict: digits only — skip "6350/6400", "n/a", floats
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

async function main() {
  console.log(
    `\n=== PROMOTE PROVENANCE → COLUMNS (${WRITE ? 'WRITE' : 'dry-run'}) ===\n`,
  );

  // Pull every provenance row that targets a calculator column, with its variant's
  // CURRENT column values so we can see which columns are still NULL (gap to fill).
  const rows = await prisma.variantSpecProvenance.findMany({
    where: { field: { in: [...COLUMN_FIELDS] }, value: { not: null } },
    select: {
      variantId: true,
      field: true,
      value: true,
      source: true,
      status: true,
      confidence: true,
      variant: {
        select: {
          name: true,
          gvmKg: true,
          gcmKg: true,
          kerbWeightKg: true,
          maxTowingCapacityKg: true,
          frontAxleLimitKg: true,
          rearAxleLimitKg: true,
          wheelbaseMm: true,
          frontOverhangMm: true,
          rearOverhangMm: true,
          totalLengthMm: true,
          maxTowBallDownloadKg: true,
        },
      },
    },
  });

  // We also need to count rows whose field has NO matching column (skipped),
  // separately — those were excluded by the `where` above, so query the total.
  const totalProvWithValue = await prisma.variantSpecProvenance.count({
    where: { value: { not: null } },
  });
  const noColumnField = totalProvWithValue - rows.length;

  // Accumulate one update per variant (a variant may fill several columns at once).
  const updates = new Map<string, Prisma.VehicleVariantUpdateInput>();
  const fillsByField: Record<string, number> = {};
  let skippedAlreadyPopulated = 0;
  let skippedNonNumeric = 0;
  let skippedLow = 0;
  const samples: string[] = [];
  const nonNumericSamples: string[] = [];

  for (const r of rows) {
    if (!isColumnField(r.field)) continue; // type-narrowing; where-clause already filtered

    const parsed = parseIntValue(r.value);
    if (parsed == null) {
      skippedNonNumeric += 1;
      if (nonNumericSamples.length < 8)
        nonNumericSamples.push(`      ${r.field}="${r.value}" (${r.source})`);
      continue;
    }

    // Confidence policy: hold LOW out of the physics columns (it stays in provenance
    // for the "help us verify" CTA). Authoritative null-confidence rows pass through.
    if (r.confidence === 'LOW' && !INCLUDE_LOW) {
      skippedLow += 1;
      continue;
    }

    const current = r.variant[r.field];
    if (current != null) {
      // Column already has a value (ROVER/QLD or an earlier promote) — never clobber.
      skippedAlreadyPopulated += 1;
      continue;
    }

    fillsByField[r.field] = (fillsByField[r.field] ?? 0) + 1;
    const u = updates.get(r.variantId) ?? {};
    u[r.field] = parsed;
    updates.set(r.variantId, u);

    if (samples.length < 8)
      samples.push(
        `      "${r.variant.name}" · ${r.field}: NULL → ${parsed} [${r.source}/${r.status}]`,
      );
  }

  const totalFills = Object.values(fillsByField).reduce((a, b) => a + b, 0);

  console.log(
    `scanned ${rows.length} provenance rows for calculator columns\n`,
  );
  console.log(`columns that WOULD be filled: ${totalFills}`);
  console.log(`variants touched: ${updates.size}\n`);
  console.log('  by field:');
  for (const f of COLUMN_FIELDS)
    if (fillsByField[f]) console.log(`    ${f.padEnd(22)} ${fillsByField[f]}`);

  console.log('\n  skipped:');
  console.log(
    `    column already populated (not clobbered): ${skippedAlreadyPopulated}`,
  );
  console.log(
    `    LOW confidence (held out${INCLUDE_LOW ? ', OVERRIDDEN' : ''}):         ${skippedLow}`,
  );
  console.log(
    `    non-numeric value (e.g. "6350/6400"):      ${skippedNonNumeric}`,
  );
  console.log(
    `    provenance field with no column:           ${noColumnField}`,
  );

  if (nonNumericSamples.length) {
    console.log('\n  non-numeric samples (skipped):');
    for (const s of nonNumericSamples) console.log(s);
  }

  console.log('\n  sample fills:');
  for (const s of samples) console.log(s);

  if (WRITE) {
    let n = 0;
    for (const [variantId, data] of updates) {
      await prisma.vehicleVariant.update({ where: { id: variantId }, data });
      if (++n % 200 === 0) console.log(`  …${n}/${updates.size} variants`);
    }
    console.log(
      `\n✓ filled ${totalFills} columns across ${updates.size} variants`,
    );
  } else {
    console.log('\n(dry-run — pass --write to persist)');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
