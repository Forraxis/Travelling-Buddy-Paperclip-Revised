/**
 * Cron-ready stub for hard-deleting accounts past their 30-day grace period.
 * Actual data purge will be implemented in Phase 16 (ops).
 *
 * Schedule: daily at 02:00 UTC (recommended)
 * Usage:   npx tsx src/jobs/hard-delete-accounts.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function hardDeleteAccounts() {
  const now = new Date();

  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      scheduledHardDeleteAt: { lte: now },
    },
    select: {
      id: true,
      email: true,
      deletedAt: true,
      scheduledHardDeleteAt: true,
      _count: {
        select: {
          setups: true,
          sessions: true,
          accounts: true,
        },
      },
    },
  });

  if (candidates.length === 0) {
    console.log(`[hard-delete-accounts] No accounts due for hard deletion.`);
    return;
  }

  console.log(
    `[hard-delete-accounts] Found ${candidates.length} account(s) past grace period:`
  );

  for (const user of candidates) {
    console.log(
      `  - User ${user.id} (${user.email}): ` +
        `deleted=${user.deletedAt?.toISOString()}, ` +
        `scheduledHardDelete=${user.scheduledHardDeleteAt?.toISOString()}, ` +
        `setups=${user._count.setups}, ` +
        `sessions=${user._count.sessions}, ` +
        `accounts=${user._count.accounts}`
    );
  }

  console.log(
    `[hard-delete-accounts] DRY RUN — no data was actually deleted. ` +
      `Implement actual purge logic in Phase 16.`
  );
}

hardDeleteAccounts()
  .catch((err) => {
    console.error("[hard-delete-accounts] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
