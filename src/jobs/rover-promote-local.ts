/**
 * Local ROVER promote — prove the candidate → CATALOGUE VehicleVariant path end to
 * end against the dev DB. Picks one PENDING ROVER candidate, promotes it through the
 * SHARED promoteSpecCandidate() helper (the same core the admin action uses), then
 * RE-promotes the same candidate to prove idempotency (same variant id, refreshed in
 * place — never a duplicate). Finally checks the variant is CATALOGUE.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-promote-local.ts
 *
 * Run AFTER rover-ingest-local.ts (which creates the PENDING candidates). This does
 * NOT change the ingest's "land PENDING / no auto-promote" policy — promotion stays
 * an explicit, separate action (gate level is Tim's Rule-11 call).
 */
import { prisma } from '../lib/db';
import { promoteSpecCandidate } from '../lib/spec-fetch/promote-candidate';

/** Resolve a moderator user for the audit trail — prefer an admin, else any user. */
async function resolveModerator(): Promise<string> {
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ??
    (await prisma.user.findFirst());
  if (admin) return admin.id;
  // Dev DB with no users — create a throwaway service user so the FK is satisfiable.
  const created = await prisma.user.create({
    data: {
      email: 'rover-promote-local@example.invalid',
      name: 'ROVER Promote (local runner)',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const candidate = await prisma.vehicleSpecCandidate.findFirst({
    where: { provider: 'ROVER', status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, makeName: true, modelName: true, variantName: true },
  });
  if (!candidate) {
    console.error(
      'No PENDING ROVER candidate found. Run rover-ingest-local.ts first.',
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const userId = await resolveModerator();
  const label = `${candidate.makeName} ${candidate.modelName} / ${candidate.variantName}`;
  console.log(`Promoting: ${label}`);

  const first = await promoteSpecCandidate(candidate.id, userId);
  console.log(
    `  → variant ${first.variantId}  created=${first.created}  ` +
      `mapped=[${Object.keys(first.patch).join(', ')}]  skipped=[${first.skipped.join(', ')}]`,
  );

  // Re-promote the SAME candidate — must refresh the same variant, not duplicate.
  const second = await promoteSpecCandidate(candidate.id, userId);
  console.log(
    `  → re-promote variant ${second.variantId}  created=${second.created}`,
  );

  const idempotent = first.variantId === second.variantId && !second.created;

  const variant = await prisma.vehicleVariant.findUniqueOrThrow({
    where: { id: first.variantId },
    select: {
      id: true,
      name: true,
      status: true,
      gvmKg: true,
      kerbWeightKg: true,
      maxTowingCapacityKg: true,
      wheelbaseMm: true,
    },
  });

  // Confirm only ONE variant exists for this candidate (no duplicate from re-promote).
  const variantCountForName = await prisma.vehicleVariant.count({
    where: { name: variant.name, status: 'CATALOGUE' },
  });

  console.log(
    `\nVARIANT: ${variant.name}  status=${variant.status}  ` +
      `GVM=${variant.gvmKg ?? '—'}  kerb=${variant.kerbWeightKg ?? '—'}  ` +
      `tow=${variant.maxTowingCapacityKg ?? '—'}  wb=${variant.wheelbaseMm ?? '—'}`,
  );
  console.log(
    `\n${idempotent ? '✅' : '❌'} idempotent re-promote (same variant id, no duplicate)` +
      `  ·  ${variant.status === 'CATALOGUE' ? '✅' : '❌'} status=CATALOGUE` +
      `  ·  variants named "${variant.name}": ${variantCountForName}`,
  );

  await prisma.$disconnect();
  process.exit(idempotent && variant.status === 'CATALOGUE' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
