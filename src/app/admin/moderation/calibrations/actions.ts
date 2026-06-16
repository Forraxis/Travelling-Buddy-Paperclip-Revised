'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  aggregateCorrection,
  type AggregateInput,
} from '@/lib/physics/calibration-contribution';

type ActionResult = { success: true } | { success: false; error: string };

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Minimal projection the aggregator needs from a stored contribution row. */
function toAggregateInput(row: {
  kerbMassDeltaKg: number | null;
  barenessWeight: number;
  cogFractionDelta: number | null;
  duplicateFingerprint: string | null;
}): AggregateInput {
  return {
    barenessWeight: row.barenessWeight,
    kerbMassDeltaKg: row.kerbMassDeltaKg ?? 0,
    cogFractionDelta: row.cogFractionDelta,
    fingerprint: row.duplicateFingerprint,
  };
}

/**
 * Approve the pending calibration contributions for a vehicle variant: mark them
 * APPROVED, re-aggregate the whole approved pool into a robust per-variant
 * correction, and upsert it. The kerb-MASS correction publishes automatically
 * (it's unconfounded enough). The kerb-CoG-FRACTION correction is GATED — it only
 * becomes live (`cogApplied`) when the moderator ticks `applyCog`, the Rule-11
 * sign-off. See CALIBRATION_SIGNOFF.md §9.
 */
export async function approveCalibrationContributions(
  vehicleVariantId: string,
  applyCog: boolean,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const pending = await prisma.calibrationContribution.findMany({
      where: { vehicleVariantId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending.length === 0) {
      return {
        success: false,
        error: 'No pending contributions for this variant',
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.calibrationContribution.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: {
          status: 'APPROVED',
          decidedById: user.id,
          decidedAt: new Date(),
        },
      });

      // Re-aggregate the full approved pool (prior approvals + these).
      const approved = await tx.calibrationContribution.findMany({
        where: { vehicleVariantId, status: 'APPROVED' },
        select: {
          kerbMassDeltaKg: true,
          barenessWeight: true,
          cogFractionDelta: true,
          duplicateFingerprint: true,
        },
      });
      const agg = aggregateCorrection(approved.map(toAggregateInput));

      await tx.vehicleCalibrationCorrection.upsert({
        where: { vehicleVariantId },
        create: {
          vehicleVariantId,
          kerbMassDeltaKg: agg.kerbMassDeltaKg,
          kerbMassSampleCount: agg.kerbMassSampleCount,
          kerbMassApplied: agg.kerbMassDeltaKg != null,
          cogFractionDelta: agg.cogFractionDelta,
          cogSampleCount: agg.cogSampleCount,
          cogApplied: applyCog && agg.cogFractionDelta != null,
        },
        update: {
          kerbMassDeltaKg: agg.kerbMassDeltaKg,
          kerbMassSampleCount: agg.kerbMassSampleCount,
          kerbMassApplied: agg.kerbMassDeltaKg != null,
          cogFractionDelta: agg.cogFractionDelta,
          cogSampleCount: agg.cogSampleCount,
          cogApplied: applyCog && agg.cogFractionDelta != null,
        },
      });

      await tx.moderationAction.create({
        data: {
          submissionType: 'calibration_contribution',
          submissionId: vehicleVariantId,
          moderatorId: user.id,
          action: 'APPROVE',
          notes: `Aggregated ${agg.kerbMassSampleCount} contribution(s); kerb-mass ${
            agg.kerbMassDeltaKg?.toFixed(0) ?? 'n/a'
          } kg, CoG Δ ${agg.cogFractionDelta?.toFixed(3) ?? 'n/a'}${
            applyCog ? ' (CoG applied)' : ' (CoG gated)'
          }`,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleCalibrationCorrection',
          entityId: vehicleVariantId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: toJson({ ...agg, cogApplied: applyCog }),
          reason: 'Community calibration correction published',
        },
      });
    });

    revalidatePath('/admin/moderation/calibrations');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Reject every pending calibration contribution for a vehicle variant. */
export async function rejectCalibrationContributions(
  vehicleVariantId: string,
  notes?: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const updated = await prisma.calibrationContribution.updateMany({
      where: { vehicleVariantId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNotes: notes,
      },
    });
    if (updated.count === 0) {
      return {
        success: false,
        error: 'No pending contributions for this variant',
      };
    }
    await prisma.moderationAction.create({
      data: {
        submissionType: 'calibration_contribution',
        submissionId: vehicleVariantId,
        moderatorId: user.id,
        action: 'REJECT',
        notes,
      },
    });
    revalidatePath('/admin/moderation/calibrations');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Un-publish (delete) the live per-variant correction. Publication is otherwise
 * forward-only — a skewed correction moves only as new contributions outvote it
 * in the median — so this is the escape hatch for a bad one. The approved
 * contribution pool is left intact, so re-approving any new pending row
 * re-derives the correction from scratch. See CALIBRATION_SIGNOFF.md §9.6.
 */
export async function unpublishCalibrationCorrection(
  vehicleVariantId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const existing = await prisma.vehicleCalibrationCorrection.findUnique({
      where: { vehicleVariantId },
    });
    if (!existing) {
      return {
        success: false,
        error: 'No published correction for this variant',
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehicleCalibrationCorrection.delete({
        where: { vehicleVariantId },
      });
      await tx.moderationAction.create({
        data: {
          submissionType: 'calibration_contribution',
          submissionId: vehicleVariantId,
          moderatorId: user.id,
          action: 'REJECT',
          notes: `Unpublished correction (was kerb-mass ${
            existing.kerbMassDeltaKg?.toFixed(0) ?? 'n/a'
          } kg, CoG Δ ${existing.cogFractionDelta?.toFixed(3) ?? 'n/a'}${
            existing.cogApplied ? ', CoG applied' : ''
          })`,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleCalibrationCorrection',
          entityId: vehicleVariantId,
          action: 'DELETE',
          changedBy: user.id,
          changes: toJson({
            kerbMassDeltaKg: existing.kerbMassDeltaKg,
            kerbMassApplied: existing.kerbMassApplied,
            cogFractionDelta: existing.cogFractionDelta,
            cogApplied: existing.cogApplied,
          }),
          reason: 'Community calibration correction unpublished',
        },
      });
    });

    revalidatePath('/admin/moderation/calibrations');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
