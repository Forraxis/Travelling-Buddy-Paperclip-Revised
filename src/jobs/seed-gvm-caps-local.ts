/**
 * Seed GVM-upgrade state cap rules as RegulationSet/Version data
 * (OVERNIGHT_BUILD_FULL.md Phase P6 — ADVISORY / unsigned).
 *
 * Seeds two regulation sets for now (Tim provides the rest):
 *   - AU_FEDERAL_GVM_CAP — the Commonwealth pre-rego second-stage / SSM path. No fixed
 *     "+X/+Y%" ceiling: the limit is whatever the second-stage manufacturer certifies.
 *     Carries `unlimited: true`. Parent of the state sets.
 *   - AU_QLD_GVM_CAP — Queensland post-rego engineer cap: **lower of +300 kg or +10%**
 *     of base GVM. Parent = AU_FEDERAL_GVM_CAP.
 *
 * Each set gets one `RegulationSetVersion` with `effectiveDate` + `changeSummary`, so
 * grandfathering falls out of the versioning (a setup pins the version that applied at
 * its date). The cap payload lives in the version `data` Json under `gvmCap`, the exact
 * `GvmCapRule` shape `validateGvmUpgradeAgainstCap` consumes.
 *
 * RULE 11: every rule is seeded `signedOff: false` — these caps are ADVISORY until Tim
 * ticks the numbers. The validator surfaces `signedOff` so the UI can label results
 * "advisory / unconfirmed". This runner NEVER changes a verdict.
 *
 * IDEMPOTENT: upserts each set by `code`; only inserts a version if none with the same
 * `effectiveDate` exists, so re-running is a no-op.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/seed-gvm-caps-local.ts
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import type { GvmCapRule } from '../lib/regulations/gvm-caps';

interface CapSetSeed {
  code: string;
  name: string;
  parentSetCode: string | null;
  /** ISO date (YYYY-MM-DD) — deterministic, no clock. */
  effectiveDate: string;
  changeSummary: string;
  rule: GvmCapRule;
  sourceUrl?: string;
}

const CAP_SETS: readonly CapSetSeed[] = [
  {
    code: 'AU_FEDERAL_GVM_CAP',
    name: 'Federal GVM upgrade (second-stage / SSM)',
    parentSetCode: null,
    effectiveDate: '2021-07-01',
    changeSummary:
      'Initial seed — Federal pre-rego second-stage / SSM path has no fixed +X/+Y% ' +
      'ceiling; the certifying second-stage manufacturer governs. ADVISORY / unsigned.',
    rule: {
      unlimited: true,
      label: 'no fixed cap (second-stage certifier governs)',
      signedOff: false,
    },
  },
  {
    code: 'AU_QLD_GVM_CAP',
    name: 'Queensland GVM upgrade cap (post-rego engineer)',
    parentSetCode: 'AU_FEDERAL_GVM_CAP',
    effectiveDate: '2021-07-01',
    changeSummary:
      'Initial seed — QLD post-rego engineer cap: lower of +300 kg or +10% of base ' +
      'GVM. ADVISORY / unsigned until Tim confirms the numbers (Rule 11).',
    rule: {
      addKg: 300,
      percentOfBase: 10,
      label: 'lower of +300 kg or +10%',
      signedOff: false,
    },
    sourceUrl: 'https://www.tmr.qld.gov.au/',
  },
];

/** Resolve an accountable actor for the version's createdBy FK (onDelete Restrict). */
async function resolveAuthor(): Promise<string> {
  const admin =
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) ??
    (await prisma.user.findFirst());
  if (admin) return admin.id;
  const created = await prisma.user.create({
    data: {
      email: 'seed-gvm-caps-local@example.invalid',
      name: 'GVM Caps Seed (local runner)',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const createdById = await resolveAuthor();

  let setsUpserted = 0;
  let versionsCreated = 0;
  let versionsSkipped = 0;

  for (const seed of CAP_SETS) {
    // Round-trip through JSON so the optional-field `GvmCapRule` interface satisfies
    // Prisma's `InputJsonValue` (same pattern as regulation.service.saveVersion).
    const data: Prisma.InputJsonValue = JSON.parse(
      JSON.stringify({
        gvmCap: seed.rule,
        sourceUrl: seed.sourceUrl ?? null,
        advisory: true,
      }),
    );

    const set = await prisma.regulationSet.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        parentSetCode: seed.parentSetCode,
        market: 'AU',
        rules: data,
      },
      create: {
        code: seed.code,
        name: seed.name,
        parentSetCode: seed.parentSetCode,
        market: 'AU',
        rules: data,
      },
      select: { id: true, code: true },
    });
    setsUpserted += 1;

    const effectiveDate = new Date(`${seed.effectiveDate}T00:00:00.000Z`);
    const existing = await prisma.regulationSetVersion.findFirst({
      where: { setId: set.id, effectiveDate },
      select: { id: true },
    });

    if (existing) {
      versionsSkipped += 1;
      console.log(
        `= ${set.code}  version @ ${seed.effectiveDate} exists — skipped`,
      );
      continue;
    }

    await prisma.regulationSetVersion.create({
      data: {
        setId: set.id,
        effectiveDate,
        changeSummary: seed.changeSummary,
        data,
        createdById,
      },
    });
    versionsCreated += 1;
    console.log(
      `+ ${set.code}  ${seed.rule.label}  (effective ${seed.effectiveDate}, advisory)`,
    );
  }

  console.log(
    `\nDone. sets upserted=${setsUpserted}  versions created=${versionsCreated}  ` +
      `skipped=${versionsSkipped}`,
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
