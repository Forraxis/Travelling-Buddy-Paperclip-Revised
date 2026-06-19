/**
 * Load the ROVER skeleton capture (the grid crawl's name-only list) into
 * RoverApprovalIndex — the enumerable "names" layer (VEHICLE_DATA_HUB.md §6.5 Layer 0).
 * Idempotent: upserts by vtaNumber, so it's safe to re-run as the backfill grows.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-skeleton-load.ts [path-to.jsonl]
 *
 * Reads ops/n8n/.rover-skeleton.jsonl by default (the gitignored capture). Does NOT
 * fetch any detail — these stay UNFETCHED until expanded on selection/curation.
 */
import { readFile } from 'node:fs/promises';
import { prisma } from '../lib/db';
import type { Prisma } from '@prisma/client';

const FILE = process.argv[2] ?? 'ops/n8n/.rover-skeleton.jsonl';

interface SkeletonRow {
  vta: string | null;
  make: string | null;
  model: string | null;
  category: string | null;
  lastUpdatedMs: number | null;
  approvalId: string | null;
  attrs?: Record<string, unknown>;
}

async function main() {
  const text = await readFile(FILE, 'utf8');
  const rows = text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SkeletonRow);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.vta || !r.approvalId) {
      skipped += 1;
      continue;
    }
    const data = {
      approvalId: r.approvalId,
      make: r.make,
      model: r.model,
      category: r.category,
      lastUpdated: r.lastUpdatedMs ? new Date(r.lastUpdatedMs) : null,
      raw: (r.attrs ?? null) as Prisma.InputJsonValue,
    };
    const existing = await prisma.roverApprovalIndex.findUnique({
      where: { vtaNumber: r.vta },
      select: { id: true },
    });
    await prisma.roverApprovalIndex.upsert({
      where: { vtaNumber: r.vta },
      // Don't clobber expandState/resultingModelId on re-run — only refresh grid fields.
      update: data,
      create: { vtaNumber: r.vta, ...data },
    });
    if (existing) updated += 1;
    else created += 1;
  }

  const total = await prisma.roverApprovalIndex.count();
  const byCat = await prisma.roverApprovalIndex.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  console.log(
    `loaded ${rows.length} rows → ${created} new / ${updated} refreshed / ${skipped} skipped`,
  );
  console.log(`RoverApprovalIndex total: ${total}`);
  console.log(
    'by category:',
    byCat.map((c) => `${c.category}:${c._count}`).join(' '),
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
