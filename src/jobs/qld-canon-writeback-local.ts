/**
 * Write-back for the qld-model-canonicalise workflow.
 *
 * Reads the AI canonicalisation results that the workflow agents wrote to
 * /tmp/qld-canon/out-*.json (keyed by index into /tmp/qld-canon/input.json) and folds
 * them into QldFleetVehicle:
 *   - isReal + HIGH/MEDIUM conf → normStatus AUTO, set canonicalModel  (now promotable)
 *   - isReal + LOW conf         → stays NEEDS_REVIEW, canonicalModel set as a hint
 *   - not a real model          → normStatus JUNK
 *
 * Idempotent — re-running is safe. Reports the resulting split + any unparseable batches.
 *
 * Usage:  DATABASE_URL=… npx jiti src/jobs/qld-canon-writeback-local.ts [--write]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const WRITE = process.argv.includes('--write');
const DIR = '/tmp/qld-canon';

interface Pair {
  i: number;
  make: string;
  model: string;
}
interface Result {
  i: number;
  canonicalModel: string;
  generation?: string;
  isReal: boolean;
  conf: 'HIGH' | 'MEDIUM' | 'LOW';
}

async function main() {
  const pairs: Pair[] = JSON.parse(readFileSync(`${DIR}/input.json`, 'utf8'));
  const byIndex = new Map(pairs.map((p) => [p.i, p]));

  // gather all batch result files
  const files = readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f));
  const results: Result[] = [];
  let badFiles = 0;
  for (const f of files) {
    try {
      const arr = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Result[];
      if (Array.isArray(arr)) results.push(...arr);
      else badFiles += 1;
    } catch {
      badFiles += 1;
      console.error(`  unparseable: ${f}`);
    }
  }
  console.error(
    `loaded ${files.length} batch files (${badFiles} bad) → ${results.length} results for ${pairs.length} pairs`,
  );

  // classify each result into the action to take
  let toAuto = 0;
  let toJunk = 0;
  let keepReview = 0;
  let unmatched = 0;
  const actions: {
    make: string;
    model: string;
    canonicalModel: string | null;
    status: 'AUTO' | 'JUNK' | 'NEEDS_REVIEW';
  }[] = [];
  const seen = new Set<number>();
  for (const r of results) {
    const p = byIndex.get(r.i);
    if (!p || seen.has(r.i)) {
      if (!p) unmatched += 1;
      continue;
    }
    seen.add(r.i);
    const cm = (r.canonicalModel ?? '').trim();
    if (r.isReal && cm && (r.conf === 'HIGH' || r.conf === 'MEDIUM')) {
      actions.push({
        make: p.make,
        model: p.model,
        canonicalModel: cm,
        status: 'AUTO',
      });
      toAuto += 1;
    } else if (!r.isReal) {
      actions.push({
        make: p.make,
        model: p.model,
        canonicalModel: null,
        status: 'JUNK',
      });
      toJunk += 1;
    } else {
      actions.push({
        make: p.make,
        model: p.model,
        canonicalModel: cm || null,
        status: 'NEEDS_REVIEW',
      });
      keepReview += 1;
    }
  }
  const missing = pairs.length - seen.size;

  console.log(`\n=== canonicalisation write-back plan ===`);
  console.log(`  → AUTO (promotable):  ${toAuto}`);
  console.log(`  → JUNK (not a model): ${toJunk}`);
  console.log(`  → kept NEEDS_REVIEW (low conf): ${keepReview}`);
  console.log(
    `  unmatched index: ${unmatched} · pairs with no result: ${missing}`,
  );

  if (!WRITE) {
    console.log(`\n(dry run — pass --write to persist)`);
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  let done = 0;
  const CONC = 16;
  for (let i = 0; i < actions.length; i += CONC) {
    await Promise.all(
      actions.slice(i, i + CONC).map((a) =>
        prisma.qldFleetVehicle.updateMany({
          where: { canonicalMake: a.make, model: a.model },
          data: { canonicalModel: a.canonicalModel, normStatus: a.status },
        }),
      ),
    );
    done += Math.min(CONC, actions.length - i);
  }
  const split = await prisma.qldFleetVehicle.groupBy({
    by: ['normStatus'],
    _count: true,
  });
  console.error(`\nwritten ${done} pair-updates.`);
  console.log('=== new row-level split ===');
  for (const s of split) console.log(`  ${s.normStatus}: ${s._count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
