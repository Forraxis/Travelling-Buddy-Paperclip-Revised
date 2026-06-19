/**
 * Prove GVM-upgrade promotion routing (OVERNIGHT_BUILD_FULL.md Phase P4).
 *
 * Picks one EXPANDED `secondStageType = GVM_UPGRADE` ROVER index row + a PENDING
 * candidate under it (the Ironman Hilux, VTA-066264, in the dev corpus) and runs the
 * SHARED `promoteSpecCandidate()` core — the same path the admin action uses. It
 * demonstrates BOTH branches of the route:
 *
 *   1. base NOT in catalogue → candidate stays PENDING, upgrade left unattached
 *      (we never fabricate the OEM base from a modifier's figures).
 *   2. with a base variant present → a `GvmUpgrade` is attached to the base, NOT a
 *      standalone "Ironman Hilux" variant; the candidate flips APPROVED.
 *
 * To show (2) deterministically the runner ensures a minimal CATALOGUE base variant
 * for the row's normalized base make/model exists (idempotent upsert) — a stand-in
 * for the real base that Phase P1 promotes. Re-running is safe (idempotent throughout).
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-promote-gvm-upgrade-local.ts
 */
import { prisma } from '../lib/db';
import { promoteSpecCandidate } from '../lib/spec-fetch/promote-candidate';
import { toSlug } from '../lib/spec-fetch/rover/gvm-upgrade';

async function resolveModerator(): Promise<string> {
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ??
    (await prisma.user.findFirst());
  if (admin) return admin.id;
  const created = await prisma.user.create({
    data: {
      email: 'rover-promote-gvm-local@example.invalid',
      name: 'ROVER Promote GVM (local runner)',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

/** Idempotently materialise a minimal CATALOGUE base variant for make/model. */
async function ensureBaseVariant(
  baseMake: string,
  baseModel: string,
): Promise<string> {
  const make = await prisma.vehicleMake.upsert({
    where: { slug: toSlug(baseMake) },
    update: {},
    create: { name: baseMake, slug: toSlug(baseMake) },
    select: { id: true },
  });
  const model = await prisma.vehicleModel.upsert({
    where: { makeId_slug: { makeId: make.id, slug: toSlug(baseModel) } },
    update: {},
    create: {
      makeId: make.id,
      name: baseModel,
      slug: toSlug(baseModel),
      bodyType: 'DUAL_CAB_UTE',
    },
    select: { id: true },
  });
  const slug = toSlug(`${baseModel}-base`);
  const existing = await prisma.vehicleVariant.findFirst({
    where: { modelId: model.id, slug },
    select: { id: true },
  });
  if (existing) return existing.id;
  const variant = await prisma.vehicleVariant.create({
    data: {
      modelId: model.id,
      status: 'CATALOGUE',
      yearFrom: 2024,
      yearTo: 2024,
      name: `${baseModel} (base)`,
      slug,
      gvmKg: 3050,
      gcmKg: 5850,
      maxTowingCapacityKg: 3500,
    },
    select: { id: true },
  });
  return variant.id;
}

async function main() {
  const userId = await resolveModerator();

  // An EXPANDED GVM_UPGRADE index row with at least one PENDING candidate.
  const row = await prisma.roverApprovalIndex.findFirst({
    where: { secondStageType: 'GVM_UPGRADE', expandState: 'EXPANDED' },
    select: {
      vtaNumber: true,
      baseMake: true,
      baseModel: true,
      modifier: true,
    },
    orderBy: { vtaNumber: 'asc' },
  });
  if (!row) {
    console.log(
      'No EXPANDED GVM_UPGRADE index row found — run normalize + classify + RVD expand first.',
    );
    await prisma.$disconnect();
    process.exit(0);
  }
  console.log(
    `GVM_UPGRADE row ${row.vtaNumber}: base "${row.baseMake} ${row.baseModel}" · modifier "${row.modifier}"`,
  );

  const candidate = await prisma.vehicleSpecCandidate.findFirst({
    where: { sourceVtaNumber: row.vtaNumber, provider: 'ROVER' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, variantName: true, status: true },
  });
  if (!candidate) {
    console.log(`No candidate under ${row.vtaNumber}.`);
    await prisma.$disconnect();
    process.exit(0);
  }
  console.log(`Candidate ${candidate.id} ("${candidate.variantName}")`);

  const variantsBefore = await prisma.vehicleVariant.count();

  // ── Branch 1: base absent → unattached (only when no base exists yet) ─────────
  const baseExists =
    row.baseMake && row.baseModel
      ? await prisma.vehicleMake
          .findUnique({
            where: { slug: toSlug(row.baseMake) },
            select: { id: true },
          })
          .then((m) =>
            m
              ? prisma.vehicleModel.findUnique({
                  where: {
                    makeId_slug: {
                      makeId: m.id,
                      slug: toSlug(row.baseModel!),
                    },
                  },
                  select: { id: true },
                })
              : null,
          )
          .then((md) =>
            md
              ? prisma.vehicleVariant.findFirst({
                  where: { modelId: md.id, status: 'CATALOGUE' },
                  select: { id: true },
                })
              : null,
          )
      : null;

  if (!baseExists) {
    const r1 = await promoteSpecCandidate(candidate.id, userId);
    console.log(`\n[1] base absent → routedAs=${r1.routedAs}`);
    if (r1.routedAs !== 'GVM_UPGRADE_UNATTACHED') {
      throw new Error(
        `Expected GVM_UPGRADE_UNATTACHED, got ${r1.routedAs} — routing broken.`,
      );
    }
  } else {
    console.log(
      `\n[1] base variant already exists (${baseExists.id}) — skipping the unattached demonstration.`,
    );
  }

  // ── Branch 2: materialise the base, re-promote → attached GvmUpgrade ──────────
  const baseVariantId = await ensureBaseVariant(row.baseMake!, row.baseModel!);
  console.log(`[2] ensured base variant ${baseVariantId}`);

  const r2 = await promoteSpecCandidate(candidate.id, userId);
  console.log(
    `[2] base present → routedAs=${r2.routedAs} · gvmUpgradeId=${r2.gvmUpgradeId} · baseVariantId=${r2.variantId}`,
  );
  if (r2.routedAs !== 'GVM_UPGRADE' || !r2.gvmUpgradeId) {
    throw new Error(`Expected GVM_UPGRADE with an id, got ${r2.routedAs}.`);
  }

  // ── Proof assertions ─────────────────────────────────────────────────────────
  const upgrade = await prisma.gvmUpgrade.findUniqueOrThrow({
    where: { id: r2.gvmUpgradeId },
    select: {
      modifierName: true,
      pathway: true,
      gvmKg: true,
      maxTowingKg: true,
      gcmKg: true,
      baseVariantId: true,
      vtaNumber: true,
      addedMassKg: true,
    },
  });
  const variantsAfter = await prisma.vehicleVariant.count();
  const candAfter = await prisma.vehicleSpecCandidate.findUniqueOrThrow({
    where: { id: candidate.id },
    select: { status: true, resultingVariantId: true },
  });

  console.log('\n── Proof ──');
  console.log('GvmUpgrade:', JSON.stringify(upgrade, null, 2));
  console.log('candidate status:', candAfter.status);
  console.log('candidate resultingVariantId:', candAfter.resultingVariantId);
  console.log(
    `variant count before=${variantsBefore} after=${variantsAfter} (the +1 is the seeded base, NOT a duplicate Ironman car)`,
  );

  // The upgrade must attach to the base, carry the kit's GVM, NOT raise GCM (the
  // overlay keeps factory GCM), and the candidate must NOT have minted a variant.
  if (upgrade.baseVariantId !== baseVariantId)
    throw new Error('Upgrade not attached to the base variant.');
  if (upgrade.gcmKg !== null)
    throw new Error('GCM should stay null (kit did not state it).');
  if (candAfter.resultingVariantId !== null)
    throw new Error('Candidate must not have minted a standalone variant.');
  if (candAfter.status !== 'APPROVED')
    throw new Error(
      'Candidate should be APPROVED after attaching the upgrade.',
    );

  console.log(
    '\n✅ P4 routing proven: GVM_UPGRADE candidate → GvmUpgrade overlay on base, no duplicate car.',
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
