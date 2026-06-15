'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { aggregatePositions } from '@/lib/fitment-positions';

type ActionResult =
  | { success: true; cogXMm?: number; cogYMm?: number }
  | { success: false; error: string };

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

interface GroupKey {
  fitmentId: string;
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
}

function variantWhere(key: GroupKey) {
  return {
    fitmentId: key.fitmentId,
    vehicleVariantId: key.vehicleVariantId,
    caravanVariantId: key.caravanVariantId,
  };
}

/**
 * Promote a community position group to canonical. Takes the median of all
 * PENDING contributions for this fitment+variant, writes it onto the
 * AccessoryFitment (so every future calculator inherits it), and marks the
 * group APPROVED. One click consolidates the consensus rather than asking the
 * moderator to judge each drag.
 */
export async function approveFitmentPositions(
  key: GroupKey,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const pending = await prisma.fitmentPositionSubmission.findMany({
      where: { ...variantWhere(key), status: 'PENDING' },
      select: { id: true, cogXMm: true, cogYMm: true },
    });
    if (pending.length === 0) {
      return { success: false, error: 'No pending submissions in this group' };
    }
    const agg = aggregatePositions(pending);
    if (!agg) return { success: false, error: 'Could not aggregate positions' };

    await prisma.$transaction(async (tx) => {
      await tx.accessoryFitment.update({
        where: { id: key.fitmentId },
        data: {
          cogXMm: agg.cogXMm,
          cogYMm: agg.cogYMm,
          confidence: 'COMMUNITY',
          source: 'USER_SUBMITTED',
        },
      });
      await tx.fitmentPositionSubmission.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: {
          status: 'APPROVED',
          decidedById: user.id,
          decidedAt: new Date(),
        },
      });
      await tx.moderationAction.create({
        data: {
          submissionType: 'fitment_position',
          submissionId: key.fitmentId,
          moderatorId: user.id,
          action: 'APPROVE',
          notes: `Promoted median of ${agg.sampleCount} contribution(s)`,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'AccessoryFitment',
          entityId: key.fitmentId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: toJson({
            cogXMm: agg.cogXMm,
            cogYMm: agg.cogYMm,
            samples: agg.sampleCount,
          }),
          reason: 'Community position consensus promoted',
        },
      });
    });

    revalidatePath('/admin/moderation/positions');
    return { success: true, cogXMm: agg.cogXMm, cogYMm: agg.cogYMm };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Reject every pending contribution for a fitment+variant group. */
export async function rejectFitmentPositions(
  key: GroupKey,
  notes?: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const updated = await prisma.fitmentPositionSubmission.updateMany({
      where: { ...variantWhere(key), status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNotes: notes,
      },
    });
    if (updated.count === 0) {
      return { success: false, error: 'No pending submissions in this group' };
    }
    await prisma.moderationAction.create({
      data: {
        submissionType: 'fitment_position',
        submissionId: key.fitmentId,
        moderatorId: user.id,
        action: 'REJECT',
        notes,
      },
    });
    revalidatePath('/admin/moderation/positions');
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
