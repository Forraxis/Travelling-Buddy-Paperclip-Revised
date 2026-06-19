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
import type {
  SpecProvenanceSource,
  SpecProvenanceStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { evaluatePromotionGate, type GateableField } from './gating';
import { buildVariantPatch, type VariantSpecPatch } from './promotion';
import { routeGvmUpgrade } from './rover/gvm-upgrade';

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
  /**
   * The resulting VehicleVariant id. For the GVM-upgrade route this is the BASE
   * variant the upgrade attached to (empty string when the base wasn't in the
   * catalogue and the candidate was left unattached).
   */
  variantId: string;
  /** False when an existing variant/upgrade was refreshed (idempotent re-promote). */
  created: boolean;
  patch: VariantSpecPatch;
  /** Fields that couldn't be mapped/parsed and were left off the variant. */
  skipped: string[];
  /**
   * How the candidate was routed (P4). 'VARIANT' = minted/refreshed a standalone
   * variant (the default OEM / non-GVM second-stage path). 'GVM_UPGRADE' = attached
   * a GvmUpgrade overlay to the base variant. 'GVM_UPGRADE_UNATTACHED' = a GVM
   * upgrade whose base isn't in the catalogue yet — candidate left PENDING.
   */
  routedAs: 'VARIANT' | 'GVM_UPGRADE' | 'GVM_UPGRADE_UNATTACHED';
  /** The created/updated GvmUpgrade id when routed as a GVM upgrade; else null. */
  gvmUpgradeId: string | null;
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

  // P4 routing: a candidate whose ROVER index row is classified GVM_UPGRADE is an
  // overlay on a factory base, not a standalone car. Look up the row (joined by the
  // candidate's source VTA) to decide the route. Non-ROVER candidates (no VTA) and
  // every non-GVM type fall through to the standard variant promotion below.
  const indexRow = candidate.sourceVtaNumber
    ? await prisma.roverApprovalIndex.findUnique({
        where: { vtaNumber: candidate.sourceVtaNumber },
        select: {
          secondStageType: true,
          baseMake: true,
          baseModel: true,
          modifier: true,
          category: true,
        },
      })
    : null;

  if (indexRow?.secondStageType === 'GVM_UPGRADE') {
    return promoteAsGvmUpgrade(candidate, indexRow, patch, skipped, userId);
  }

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

    // Per-field provenance — the Vehicle Data Hub spine (VEHICLE_DATA_HUB.md). Record
    // each promoted field's accepted value + where it came from; ROVER/corroborated →
    // CONFIRMED, else ESTIMATE (gated). Keyed by (variantId, field) so a re-promote
    // refreshes in place.
    for (const f of candidate.fields) {
      const value =
        f.adminValue && f.adminValue !== '' ? f.adminValue : f.value;
      if (value === null) continue; // only record fields we actually promoted
      const fieldProvider = f.provider ?? candidate.provider;
      const source: SpecProvenanceSource =
        fieldProvider === 'ROVER'
          ? 'ROVER'
          : fieldProvider === 'ADMIN'
            ? 'MANUAL'
            : 'CLAUDE';
      const status: SpecProvenanceStatus = f.corroborated
        ? 'CONFIRMED'
        : 'ESTIMATE';
      const provData = {
        value,
        source,
        status,
        confidence: f.confidence,
        sourceUrl: f.sourceUrl,
        corroboratingCount: f.corroborated ? 1 : 0,
        asOf: new Date(),
        notes: f.notes,
      };
      await tx.variantSpecProvenance.upsert({
        where: { variantId_field: { variantId, field: f.field } },
        update: provData,
        create: { variantId, field: f.field, ...provData },
      });
    }

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

    return {
      variantId,
      created,
      patch,
      skipped,
      routedAs: 'VARIANT' as const,
      gvmUpgradeId: null,
    };
  });
}

/** Index identity needed to route a GVM-upgrade promotion (from the ROVER row). */
type GvmIndexRow = {
  secondStageType: import('@prisma/client').RoverSecondStageType;
  baseMake: string | null;
  baseModel: string | null;
  modifier: string | null;
  category: string | null;
};

/**
 * Route a GVM_UPGRADE candidate to a GvmUpgrade overlay on the base variant instead
 * of minting a standalone variant (P4). Resolves the base by normalized make/model;
 * when found, creates/refreshes the GvmUpgrade, marks the candidate APPROVED, and
 * audits. When the base isn't in the catalogue, the candidate is left PENDING + a
 * note is recorded — the base must be promoted first (we never fabricate the OEM
 * base from a modifier's figures). No variant is created either way.
 *
 * Note: the base factory category isn't read from the candidate's row (it carries the
 * uprated category), so the pre-rego heuristic uses a null baseCategory here and
 * defaults to POST_REGO_SSM — the admin can refine the pathway later (P8).
 */
async function promoteAsGvmUpgrade(
  candidate: {
    id: string;
    status: import('@prisma/client').SubmissionStatus;
    sourceVtaNumber: string | null;
  },
  indexRow: GvmIndexRow,
  patch: VariantSpecPatch,
  skipped: string[],
  userId: string,
): Promise<PromoteResult> {
  return prisma.$transaction(async (tx) => {
    const routed = await routeGvmUpgrade(tx, patch, {
      baseMake: indexRow.baseMake,
      baseModel: indexRow.baseModel,
      modifier: indexRow.modifier,
      vtaNumber: candidate.sourceVtaNumber,
      category: indexRow.category,
      baseCategory: null,
    });

    if (routed.unattached) {
      // Leave the candidate PENDING + record why; the base must land first.
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleSpecCandidate',
          entityId: candidate.id,
          action: 'UPDATE',
          changedBy: userId,
          changes: toJson({
            gvmUpgradeRouting: 'UNATTACHED',
            note: routed.note,
          }),
          reason: routed.note,
        },
      });
      return {
        variantId: '',
        created: false,
        patch,
        skipped,
        routedAs: 'GVM_UPGRADE_UNATTACHED' as const,
        gvmUpgradeId: null,
      };
    }

    await tx.vehicleSpecCandidate.update({
      where: { id: candidate.id },
      data: {
        status: 'APPROVED',
        // No resultingVariant — the candidate became an overlay, not a variant.
        decidedById: userId,
        decidedAt: new Date(),
        decisionNotes: routed.note,
      },
    });

    await tx.moderationAction.create({
      data: {
        submissionType: 'vehicle_spec_candidate',
        submissionId: candidate.id,
        moderatorId: userId,
        action: 'APPROVE',
        notes: routed.note,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'VehicleSpecCandidate',
        entityId: candidate.id,
        action: 'UPDATE',
        changedBy: userId,
        changes: toJson({
          status: { from: candidate.status, to: 'APPROVED' },
          gvmUpgradeRouting: 'ATTACHED',
          gvmUpgradeId: routed.gvmUpgradeId,
          baseVariantId: routed.baseVariantId,
          patch,
        }),
        reason: 'GVM-upgrade candidate promoted to a GvmUpgrade overlay',
      },
    });

    return {
      variantId: routed.baseVariantId ?? '',
      created: true,
      patch,
      skipped,
      routedAs: 'GVM_UPGRADE' as const,
      gvmUpgradeId: routed.gvmUpgradeId,
    };
  });
}
