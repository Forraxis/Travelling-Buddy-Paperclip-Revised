/**
 * Print the dork-vehicles that still lack axle coverage — feeds the alt-dork gap pass.
 *
 * For each VMAP entry, counts how many of its catalogue variants (across all its slugs)
 * have a frontAxleLimitKg provenance row. Entries below the threshold are "gaps" worth a
 * second search with different dork phrasings. Prints a comma-separated --vehicles= list
 * on the LAST line (stdout) so a shell script can capture it; the report goes to stderr.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/brave-gaps-local.ts            # threshold 0 (no axle at all)
 *   DATABASE_URL=… npx tsx src/jobs/brave-gaps-local.ts --min-pct=50
 */
import { prisma } from '../lib/db';
import { VMAP } from '../lib/spec-fetch/brave-vmap';

const MIN_PCT = Number(
  process.argv
    .find((a) => a.startsWith('--min-pct='))
    ?.slice('--min-pct='.length) ?? '1',
);

async function main() {
  const gaps: string[] = [];
  const rows: string[] = [];
  for (const [vehicle, entry] of Object.entries(VMAP)) {
    const variants = await prisma.vehicleVariant.count({
      where: {
        gvmKg: { not: null },
        model: { make: { name: entry.make }, slug: { in: entry.slugs } },
      },
    });
    const withAxle = await prisma.vehicleVariant.count({
      where: {
        gvmKg: { not: null },
        model: { make: { name: entry.make }, slug: { in: entry.slugs } },
        specProvenance: { some: { field: 'frontAxleLimitKg' } },
      },
    });
    const pct = variants ? Math.round((withAxle / variants) * 100) : 0;
    rows.push(
      `  ${vehicle.padEnd(28)} ${withAxle}/${variants} axle (${pct}%)${pct < MIN_PCT ? '  ← GAP' : ''}`,
    );
    if (pct < MIN_PCT) gaps.push(vehicle);
  }
  rows.sort();
  process.stderr.write(
    `\n=== AXLE COVERAGE BY DORK-VEHICLE (gap < ${MIN_PCT}%) ===\n`,
  );
  process.stderr.write(rows.join('\n') + '\n');
  process.stderr.write(`\n${gaps.length} gap vehicles\n`);
  // The capturable line (stdout):
  process.stdout.write(gaps.join(',') + '\n');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
