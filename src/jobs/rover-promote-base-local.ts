/**
 * Promote BASE (OEM, non-second-stage) ROVER candidates → CATALOGUE variants, in bulk.
 *
 * For every `isSecondStage=false` + EXPANDED RoverApprovalIndex row, promote each of
 * its PENDING ROVER VehicleSpecCandidates (joined by sourceVtaNumber = the row's
 * vtaNumber) through the SHARED promoteSpecCandidate() helper — the same core the
 * admin action uses. EXPANDED means the RVD detail was fetched and per-variant
 * candidates exist; isSecondStage=false keeps this to OEM base variants (the GVM-
 * upgrade / conversion second-stage rows route differently in P4).
 *
 * IDEMPOTENT: a candidate already promoted (resultingVariantId set, status APPROVED)
 * is refreshed in place by promoteSpecCandidate rather than duplicated, so re-running
 * is safe. We skip already-APPROVED candidates in the query so a re-run is a fast no-op.
 *
 * GATE-SAFE: a candidate blocked by the promotion gate (uncorroborated compliance-
 * critical field, no admin override) is counted and skipped — it does NOT abort the
 * batch. Promotion gate level stays Tim's Rule-11 call; this runner does not override.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-promote-base-local.ts
 *
 * Run AFTER the normalize pass (sets isSecondStage) and the RVD ingest/expand path
 * (lands PENDING candidates + flips index rows to EXPANDED).
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
  // Dev DB with no users — create a throwaway service user so the FK is satisfiable.
  const created = await prisma.user.create({
    data: {
      email: 'rover-promote-base-local@example.invalid',
      name: 'ROVER Promote Base (local runner)',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  // Base (OEM, non-second-stage) index rows whose RVD detail has been expanded.
  const baseRows = await prisma.roverApprovalIndex.findMany({
    where: { isSecondStage: false, expandState: 'EXPANDED' },
    select: { vtaNumber: true, baseMake: true, baseModel: true },
    orderBy: { vtaNumber: 'asc' },
  });

  console.log(
    `Base + EXPANDED index rows: ${baseRows.length}` +
      (baseRows.length === 0
        ? '  (nothing to promote — run normalize + RVD expand first)'
        : ''),
  );

  const userId = await resolveModerator();

  let candidatesSeen = 0;
  let created = 0;
  let refreshed = 0;
  let blocked = 0;
  let failed = 0;

  for (const row of baseRows) {
    // PENDING (not-yet-promoted) ROVER candidates for this VTA. Already-APPROVED
    // candidates are skipped here so a re-run is a fast no-op; promoteSpecCandidate
    // is still idempotent if one is reprocessed.
    const candidates = await prisma.vehicleSpecCandidate.findMany({
      where: {
        provider: 'ROVER',
        status: 'PENDING',
        sourceVtaNumber: row.vtaNumber,
      },
      select: { id: true, makeName: true, modelName: true, variantName: true },
      orderBy: { createdAt: 'asc' },
    });
    if (candidates.length === 0) continue;

    const label =
      `${row.baseMake ?? '—'} ${row.baseModel ?? '—'}`.trim() || row.vtaNumber;
    console.log(
      `\n${row.vtaNumber}  ${label}  · ${candidates.length} candidate(s)`,
    );

    for (const c of candidates) {
      candidatesSeen += 1;
      const variantLabel = c.variantName ?? `${c.makeName} ${c.modelName}`;
      try {
        const result = await promoteSpecCandidate(c.id, userId);
        if (result.created) created += 1;
        else refreshed += 1;
        console.log(
          `  ✅ ${variantLabel} → variant ${result.variantId}` +
            ` (created=${result.created})`,
        );
      } catch (err) {
        if (err instanceof PromotionGateError) {
          blocked += 1;
          console.log(
            `  ⏭️  ${variantLabel} BLOCKED by gate: ${err.blockingFields.join(', ')}`,
          );
        } else {
          failed += 1;
          console.error(`  ❌ ${variantLabel} failed:`, err);
        }
      }
    }
  }

  console.log(
    `\nDone. candidates seen=${candidatesSeen}  promoted(created=${created} refreshed=${refreshed})` +
      `  blocked=${blocked}  failed=${failed}`,
  );

  await prisma.$disconnect();
  // Non-zero only on an unexpected failure; a gate block is an expected outcome.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
