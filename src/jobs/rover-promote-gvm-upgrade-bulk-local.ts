/**
 * Bulk-promote ROVER GVM-upgrade rows → `GvmUpgrade` overlays on the catalogue base.
 *
 * For every EXPANDED `secondStageType = GVM_UPGRADE` RoverApprovalIndex row, run its
 * PENDING ROVER candidate(s) through the SHARED `promoteSpecCandidate()` core — the same
 * path the admin action uses. That core routes a GVM_UPGRADE candidate to a `GvmUpgrade`
 * overlay attached to the resolved base variant (via `resolveBaseVariant`), NEVER a
 * standalone make. If the OEM base isn't in the catalogue yet the candidate is left
 * PENDING (routedAs=GVM_UPGRADE_UNATTACHED) — we never fabricate the base from a
 * modifier's figures. (Run the QLD/ROVER base promote first so bases exist.)
 *
 * NOTE (2026-06): only 1 of 174 GVM_UPGRADE rows is EXPANDED in the dev corpus — the
 * other 173 are UNFETCHED and need the ROVER RVD detail-fetch, which must run via the
 * n8n/VPN egress path, not the sandbox. This job sweeps whatever is expanded; re-run it
 * after each expansion batch (it's idempotent).
 *
 * IDEMPOTENT: an already-attached upgrade is refreshed in place (upsert on
 * (baseVariantId, vtaNumber)); an already-APPROVED candidate is skipped by the query.
 * GATE-SAFE: a gate-blocked candidate is counted and skipped, never aborts the batch.
 *
 * Usage:  DATABASE_URL=… npx jiti src/jobs/rover-promote-gvm-upgrade-bulk-local.ts
 */
import { prisma } from '../lib/db';
import {
  PromotionGateError,
  promoteSpecCandidate,
} from '../lib/spec-fetch/promote-candidate';

/** Resolve a moderator user for the audit trail — prefer an admin, else any user. */
async function resolveModerator(): Promise<string> {
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ??
    (await prisma.user.findFirst());
  if (admin) return admin.id;
  const created = await prisma.user.create({
    data: {
      email: 'rover-promote-gvm-bulk-local@example.invalid',
      name: 'ROVER Promote GVM Bulk (local runner)',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const rows = await prisma.roverApprovalIndex.findMany({
    where: { secondStageType: 'GVM_UPGRADE', expandState: 'EXPANDED' },
    select: {
      vtaNumber: true,
      baseMake: true,
      baseModel: true,
      modifier: true,
    },
    orderBy: { vtaNumber: 'asc' },
  });

  const totalClassified = await prisma.roverApprovalIndex.count({
    where: { secondStageType: 'GVM_UPGRADE' },
  });
  console.log(
    `GVM_UPGRADE rows: ${totalClassified} classified · ${rows.length} EXPANDED (rest need RVD expansion via VPN).`,
  );

  const userId = await resolveModerator();

  let seen = 0;
  let attached = 0;
  let refreshed = 0;
  let unattached = 0;
  let blocked = 0;
  let failed = 0;

  for (const row of rows) {
    const candidates = await prisma.vehicleSpecCandidate.findMany({
      where: {
        provider: 'ROVER',
        status: 'PENDING',
        sourceVtaNumber: row.vtaNumber,
      },
      select: { id: true, variantName: true },
      orderBy: { createdAt: 'asc' },
    });
    if (candidates.length === 0) continue;

    const label = `${row.baseMake ?? '—'} ${row.baseModel ?? '—'} · ${row.modifier ?? '—'}`;
    console.log(
      `\n${row.vtaNumber}  ${label}  · ${candidates.length} candidate(s)`,
    );

    for (const c of candidates) {
      seen += 1;
      try {
        const r = await promoteSpecCandidate(c.id, userId);
        if (r.routedAs === 'GVM_UPGRADE_UNATTACHED') {
          unattached += 1;
          console.log(
            `  ⏭️  ${c.variantName ?? c.id} → base not in catalogue yet (left PENDING)`,
          );
        } else if (r.routedAs === 'GVM_UPGRADE') {
          if (r.created) attached += 1;
          else refreshed += 1;
          console.log(
            `  ✅ ${c.variantName ?? c.id} → GvmUpgrade ${r.gvmUpgradeId} on base ${r.variantId} (created=${r.created})`,
          );
        } else {
          // Unexpected route (e.g. classified GVM_UPGRADE but resolved as a base car).
          failed += 1;
          console.log(
            `  ⚠️  ${c.variantName ?? c.id} → unexpected routedAs=${r.routedAs}`,
          );
        }
      } catch (err) {
        if (err instanceof PromotionGateError) {
          blocked += 1;
          console.log(
            `  ⏭️  ${c.variantName ?? c.id} BLOCKED by gate: ${err.blockingFields.join(', ')}`,
          );
        } else {
          failed += 1;
          console.error(`  ❌ ${c.variantName ?? c.id} failed:`, err);
        }
      }
    }
  }

  console.log(
    `\nDone. candidates seen=${seen}  attached(new=${attached} refreshed=${refreshed})` +
      `  unattached(base-missing)=${unattached}  blocked=${blocked}  failed=${failed}`,
  );

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
