/**
 * Hard-delete accounts past their 30-day grace period (soft-deleted users whose
 * `scheduledHardDeleteAt` is due).
 *
 * Schedule: daily at 02:00 UTC (recommended).
 * Usage:
 *   npx tsx src/jobs/hard-delete-accounts.ts            # live purge
 *   npx tsx src/jobs/hard-delete-accounts.ts --dry-run  # preview only
 *
 * Two paths, decided per user by their relations (see prisma/schema.prisma):
 *
 *  1. NORMAL user → `prisma.user.delete()`. The DB does the rest: Cascade drops
 *     their sessions, accounts, setups and submissions; SetNull anonymises the
 *     community content they contributed (variants, fitment verifications,
 *     position/calibration contributions). Full erasure.
 *
 *  2. ACCOUNTABLE actor (has AuditLog / ModerationAction / RegulationSetVersion /
 *     AdminConfig rows — all `onDelete: Restrict`) → cannot be deleted without
 *     destroying an accountability trail we must keep. Instead we ANONYMISE in
 *     place: scrub PII (email/name/image/password/home state), revoke access
 *     (delete sessions + accounts), drop personal setups, and retain the now-
 *     tombstoned user row so those Restrict FKs stay valid. GDPR-appropriate for
 *     a moderator/admin: the person is erased, the audit record of their actions
 *     is preserved against an anonymous id.
 *
 * Each user is processed with isolated error handling, so one failure never
 * aborts the batch.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Standalone client (this runs as a cron script, not inside the Next server), so
// it carries its own PrismaPg adapter — the same setup as src/lib/db.ts.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DRY_RUN = process.argv.includes('--dry-run');

/** Relations with `onDelete: Restrict` — their presence blocks a plain delete. */
async function hasAccountabilityTrail(userId: string): Promise<boolean> {
  const [audits, moderations, regulations, adminConfigs] = await Promise.all([
    prisma.auditLog.count({ where: { changedBy: userId } }),
    prisma.moderationAction.count({ where: { moderatorId: userId } }),
    prisma.regulationSetVersion.count({ where: { createdById: userId } }),
    prisma.adminConfig.count({ where: { updatedById: userId } }),
  ]);
  return audits + moderations + regulations + adminConfigs > 0;
}

/** Scrub PII and revoke access while keeping the (now anonymous) user row. */
async function anonymiseUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.setup.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        // Email is unique + non-null — give it a stable, non-routable tombstone.
        email: `deleted-${userId}@deleted.invalid`,
        name: null,
        image: null,
        password: null,
        homeState: null,
        notificationPreferences: {},
        // Mark done so the next run doesn't reprocess it; keep deletedAt as the
        // record that this account was removed.
        scheduledHardDeleteAt: null,
      },
    });
  });
}

/** Full erasure: the DB cascade/set-null does the work. */
async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

export async function hardDeleteAccounts(): Promise<{
  deleted: number;
  anonymised: number;
  failed: number;
}> {
  const now = new Date();
  const candidates = await prisma.user.findMany({
    where: { deletedAt: { not: null }, scheduledHardDeleteAt: { lte: now } },
    select: { id: true, email: true, scheduledHardDeleteAt: true },
  });

  if (candidates.length === 0) {
    console.log('[hard-delete-accounts] No accounts due for hard deletion.');
    return { deleted: 0, anonymised: 0, failed: 0 };
  }

  console.log(
    `[hard-delete-accounts] ${candidates.length} account(s) due` +
      (DRY_RUN ? ' (DRY RUN — no changes will be made):' : ':'),
  );

  let deleted = 0;
  let anonymised = 0;
  let failed = 0;

  for (const user of candidates) {
    try {
      const accountable = await hasAccountabilityTrail(user.id);
      const action = accountable ? 'anonymise' : 'delete';
      console.log(`  - ${user.id} (${user.email}) → ${action}`);

      if (DRY_RUN) {
        if (accountable) anonymised++;
        else deleted++;
        continue;
      }

      if (accountable) {
        await anonymiseUser(user.id);
        anonymised++;
      } else {
        await deleteUser(user.id);
        deleted++;
      }
    } catch (err) {
      failed++;
      console.error(
        `[hard-delete-accounts] FAILED for ${user.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[hard-delete-accounts] Done — deleted=${deleted}, anonymised=${anonymised}, failed=${failed}` +
      (DRY_RUN ? ' (DRY RUN)' : ''),
  );
  return { deleted, anonymised, failed };
}

// Run when invoked directly (npx tsx …); no-op when imported.
if (process.argv[1] && process.argv[1].includes('hard-delete-accounts')) {
  hardDeleteAccounts()
    .catch((err) => {
      console.error('[hard-delete-accounts] Fatal error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
