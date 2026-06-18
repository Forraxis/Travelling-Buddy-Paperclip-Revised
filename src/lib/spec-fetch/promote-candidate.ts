/**
 * Promote a VehicleSpecCandidate → a CATALOGUE VehicleVariant.
 *
 * The DB-touching core of the admin promote action, extracted so the same path is
 * reusable from a non-request context (the ROVER local runner, a future batch
 * promote) without duplicating the gate + transaction + audit shape. The admin
 * server action and any runner both call this.
 *
 * Mirrors the moderation approve path's transaction shape (ModerationAction +
 * AuditLog) and enforces the promotion gate: an uncorroborated compliance-critical
 * field blocks promotion unless the candidate carries an admin override.
 *
 * IDEMPOTENT: if the candidate already has a `resultingVariantId`, the existing
 * variant is updated in place (re-promote refreshes the mapped figures) rather
 * than creating a duplicate — so a ROVER amendment that refreshed the candidate
 * can be re-promoted safely.
 */
import { prisma } from '@/lib/db';
import { evaluatePromotionGate, type GateableField } from './gating';
import { buildVariantPatch, type VariantSpecPatch } from './promotion';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Short random suffix to keep generated slugs unique. */
function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function toJson(
  value: unknown,
): import('@prisma/client').Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as import('@prisma/client').Prisma.InputJsonValue;
}

/** Thrown when the promotion gate blocks (uncorroborated critical, no override). */
export class PromotionGateError extends Error {
  readonly blockingFields: string[];
  constructor(blockingFields: string[]) {
    super(
      `Blocked: uncorroborated compliance-critical field(s): ${blockingFields.join(
        ', ',
      )}. Corroborate them or record an override.`,
    );
    this.name = 'PromotionGateError';
    this.blockingFields = blockingFields;
  }
}

export interface PromoteResult {
  variantId: string;
  /** False when an existing variant was refreshed (idempotent re-promote). */
  created: boolean;
  patch: VariantSpecPatch;
  /** Fields that couldn't be mapped/parsed and were left off the variant. */
  skipped: string[];
}

/**
 * Promote one candidate. `userId` is the acting moderator (admin user, or the
 * service user a runner resolves). Throws {@link PromotionGateError} when blocked.
 */
export async function promoteSpecCandidate(
  candidateId: string,
  userId: string,
): Promise<PromoteResult> {
  const candidate = await prisma.vehicleSpecCandidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { fields: true },
  });

  const gateFields: GateableField[] = candidate.fields.map((f) => ({
    field: f.field,
    value: f.value,
    adminValue: f.adminValue,
    corroborated: f.corroborated,
  }));
  const hasOverride = candidate.criticalOverrideById !== null;
  const gate = evaluatePromotionGate(gateFields, hasOverride);
  if (!gate.allowed) {
    throw new PromotionGateError(gate.blockingFields);
  }

  const { patch, skipped } = buildVariantPatch(gateFields);

  return prisma.$transaction(async (tx) => {
    // Resolve / create make + model from the candidate's free text.
    const makeSlug = toSlug(candidate.makeName);
    const make = await tx.vehicleMake.upsert({
      where: { slug: makeSlug },
      update: {},
      create: { name: candidate.makeName, slug: makeSlug },
      select: { id: true },
    });
    const modelSlug = toSlug(candidate.modelName);
    const model = await tx.vehicleModel.upsert({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
      update: {},
      create: {
        makeId: make.id,
        name: candidate.modelName,
        slug: modelSlug,
        bodyType: candidate.bodyType ?? 'OTHER',
      },
      select: { id: true },
    });

    const variantName =
      candidate.variantName ?? `${candidate.yearFrom} ${candidate.modelName}`;
    const yearTo = candidate.yearTo ?? candidate.yearFrom;

    let variantId: string;
    let created: boolean;

    if (candidate.resultingVariantId) {
      // Idempotent re-promote: refresh the already-promoted variant in place.
      const updated = await tx.vehicleVariant.update({
        where: { id: candidate.resultingVariantId },
        data: {
          modelId: model.id,
          status: 'CATALOGUE',
          yearFrom: candidate.yearFrom,
          yearTo,
          name: variantName,
          market: candidate.market,
          ...patch,
        },
        select: { id: true },
      });
      variantId = updated.id;
      created = false;
    } else {
      const createdVariant = await tx.vehicleVariant.create({
        data: {
          modelId: model.id,
          status: 'CATALOGUE',
          yearFrom: candidate.yearFrom,
          yearTo,
          isCurrentProduction: false,
          name: variantName,
          slug: toSlug(`${variantName}-${candidate.yearFrom}-${slugSuffix()}`),
          market: candidate.market,
          ...patch,
        },
        select: { id: true },
      });
      variantId = createdVariant.id;
      created = true;
    }

    await tx.vehicleSpecCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'APPROVED',
        resultingVariantId: variantId,
        decidedById: userId,
        decidedAt: new Date(),
      },
    });

    await tx.moderationAction.create({
      data: {
        submissionType: 'vehicle_spec_candidate',
        submissionId: candidateId,
        moderatorId: userId,
        action: 'APPROVE',
        notes: hasOverride
          ? `Promoted with override: ${candidate.criticalOverrideNote ?? ''}`
          : created
            ? 'Promoted to CATALOGUE'
            : 'Re-promoted (refreshed CATALOGUE variant)',
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'VehicleSpecCandidate',
        entityId: candidateId,
        action: 'UPDATE',
        changedBy: userId,
        changes: toJson({
          status: { from: candidate.status, to: 'APPROVED' },
          promotedVariantId: variantId,
          patch,
          override: hasOverride,
          rePromote: !created,
        }),
        reason: created
          ? 'Spec candidate promoted to CATALOGUE'
          : 'Spec candidate re-promoted (figures refreshed)',
      },
    });

    return { variantId, created, patch, skipped };
  });
}
