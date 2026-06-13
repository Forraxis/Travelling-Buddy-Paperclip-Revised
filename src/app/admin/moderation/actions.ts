'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { handleModerationDecision } from '@/lib/moderation';

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type SubmissionType = 'vehicle' | 'caravan' | 'accessory';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function getEntityName(submittedData: unknown): string {
  if (!submittedData || typeof submittedData !== 'object') return 'Submission';
  const d = submittedData as Record<string, unknown>;
  if (d.name && typeof d.name === 'string') return d.name;
  const make = d.newMakeName ?? d.makeName ?? '';
  const model = d.newModelName ?? d.modelName ?? '';
  const year = d.year ?? '';
  const variant = d.variantName ?? '';
  const parts = [year, make, model, variant].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Submission';
}

export async function approveSubmission(
  id: string,
  type: SubmissionType,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    let submitterId: string;
    let entityName: string;
    let resultingVariantId: string | null = null;

    if (type === 'vehicle') {
      const sub = await prisma.vehicleSubmission.findUniqueOrThrow({
        where: { id },
        select: {
          submitterId: true,
          submittedData: true,
          status: true,
          resultingVariantId: true,
        },
      });
      if (sub.status !== 'PENDING') {
        return { success: false, error: 'Submission is not pending' };
      }
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);
      resultingVariantId = sub.resultingVariantId;

      await prisma.$transaction(async (tx) => {
        await tx.vehicleSubmission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        if (resultingVariantId) {
          await tx.vehicleVariant.update({
            where: { id: resultingVariantId },
            data: { status: 'CATALOGUE' },
          });
        }
        await tx.moderationAction.create({
          data: {
            submissionType: 'vehicle',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'VehicleSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'APPROVED' } }),
            reason: 'Moderator approved',
          },
        });
      });
    } else if (type === 'caravan') {
      const sub = await prisma.caravanSubmission.findUniqueOrThrow({
        where: { id },
        select: {
          submitterId: true,
          submittedData: true,
          status: true,
          resultingVariantId: true,
        },
      });
      if (sub.status !== 'PENDING') {
        return { success: false, error: 'Submission is not pending' };
      }
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);
      resultingVariantId = sub.resultingVariantId;

      await prisma.$transaction(async (tx) => {
        await tx.caravanSubmission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        if (resultingVariantId) {
          await tx.caravanVariant.update({
            where: { id: resultingVariantId },
            data: { status: 'CATALOGUE' },
          });
        }
        await tx.moderationAction.create({
          data: {
            submissionType: 'caravan',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'CaravanSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'APPROVED' } }),
            reason: 'Moderator approved',
          },
        });
      });
    } else {
      const sub = await prisma.accessorySubmission.findUniqueOrThrow({
        where: { id },
        select: { submitterId: true, submittedData: true, status: true },
      });
      if (sub.status !== 'PENDING') {
        return { success: false, error: 'Submission is not pending' };
      }
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);

      await prisma.$transaction(async (tx) => {
        await tx.accessorySubmission.update({
          where: { id },
          data: {
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        await tx.moderationAction.create({
          data: {
            submissionType: 'accessory',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'AccessorySubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'APPROVED' } }),
            reason: 'Moderator approved',
          },
        });
      });
    }

    await handleModerationDecision({
      submitterId,
      submissionId: id,
      kind: type,
      decision: 'APPROVED',
      entityName,
      catalogueUrl: '/account/submissions',
    });

    revalidatePath('/admin/moderation');
    revalidatePath(`/admin/moderation/${id}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to approve',
    };
  }
}

export async function rejectSubmission(
  id: string,
  type: SubmissionType,
  reason: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  if (!reason.trim())
    return { success: false, error: 'Rejection reason is required' };

  try {
    let submitterId: string;
    let entityName: string;

    if (type === 'vehicle') {
      const sub = await prisma.vehicleSubmission.findUniqueOrThrow({
        where: { id },
        select: { submitterId: true, submittedData: true, status: true },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);

      await prisma.$transaction(async (tx) => {
        await tx.vehicleSubmission.update({
          where: { id },
          data: {
            status: 'REJECTED',
            decidedById: user.id,
            decidedAt: new Date(),
            decisionNotes: reason,
          },
        });
        await tx.moderationAction.create({
          data: {
            submissionType: 'vehicle',
            submissionId: id,
            moderatorId: user.id,
            action: 'REJECT',
            notes: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'VehicleSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'REJECTED' } }),
            reason,
          },
        });
      });
    } else if (type === 'caravan') {
      const sub = await prisma.caravanSubmission.findUniqueOrThrow({
        where: { id },
        select: { submitterId: true, submittedData: true, status: true },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);

      await prisma.$transaction(async (tx) => {
        await tx.caravanSubmission.update({
          where: { id },
          data: {
            status: 'REJECTED',
            decidedById: user.id,
            decidedAt: new Date(),
            decisionNotes: reason,
          },
        });
        await tx.moderationAction.create({
          data: {
            submissionType: 'caravan',
            submissionId: id,
            moderatorId: user.id,
            action: 'REJECT',
            notes: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'CaravanSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'REJECTED' } }),
            reason,
          },
        });
      });
    } else {
      const sub = await prisma.accessorySubmission.findUniqueOrThrow({
        where: { id },
        select: { submitterId: true, submittedData: true, status: true },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      entityName = getEntityName(sub.submittedData);

      await prisma.$transaction(async (tx) => {
        await tx.accessorySubmission.update({
          where: { id },
          data: {
            status: 'REJECTED',
            decidedById: user.id,
            decidedAt: new Date(),
            decisionNotes: reason,
          },
        });
        await tx.moderationAction.create({
          data: {
            submissionType: 'accessory',
            submissionId: id,
            moderatorId: user.id,
            action: 'REJECT',
            notes: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'AccessorySubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({ status: { from: 'PENDING', to: 'REJECTED' } }),
            reason,
          },
        });
      });
    }

    await handleModerationDecision({
      submitterId,
      submissionId: id,
      kind: type,
      decision: 'REJECTED',
      entityName,
      rejectionReason: reason,
    });

    revalidatePath('/admin/moderation');
    revalidatePath(`/admin/moderation/${id}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to reject',
    };
  }
}

export async function editAndApproveSubmission(
  id: string,
  type: SubmissionType,
  edits: Record<string, unknown>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    let submitterId: string;
    let entityName: string;
    let resultingVariantId: string | null = null;

    if (type === 'vehicle') {
      const sub = await prisma.vehicleSubmission.findUniqueOrThrow({
        where: { id },
        select: {
          submitterId: true,
          submittedData: true,
          status: true,
          resultingVariantId: true,
        },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      const merged = { ...(sub.submittedData as object), ...edits };
      entityName = getEntityName(merged);
      resultingVariantId = sub.resultingVariantId;

      await prisma.$transaction(async (tx) => {
        await tx.vehicleSubmission.update({
          where: { id },
          data: {
            submittedData: toJson(merged),
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        if (resultingVariantId) {
          await tx.vehicleVariant.update({
            where: { id: resultingVariantId },
            data: { status: 'CATALOGUE' },
          });
        }
        await tx.moderationAction.create({
          data: {
            submissionType: 'vehicle',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
            notes: 'Edit and approve',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'VehicleSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({
              status: { from: 'PENDING', to: 'APPROVED' },
              edits,
            }),
            reason: 'Moderator edit and approve',
          },
        });
      });
    } else if (type === 'caravan') {
      const sub = await prisma.caravanSubmission.findUniqueOrThrow({
        where: { id },
        select: {
          submitterId: true,
          submittedData: true,
          status: true,
          resultingVariantId: true,
        },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      const merged = { ...(sub.submittedData as object), ...edits };
      entityName = getEntityName(merged);
      resultingVariantId = sub.resultingVariantId;

      await prisma.$transaction(async (tx) => {
        await tx.caravanSubmission.update({
          where: { id },
          data: {
            submittedData: toJson(merged),
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        if (resultingVariantId) {
          await tx.caravanVariant.update({
            where: { id: resultingVariantId },
            data: { status: 'CATALOGUE' },
          });
        }
        await tx.moderationAction.create({
          data: {
            submissionType: 'caravan',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
            notes: 'Edit and approve',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'CaravanSubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({
              status: { from: 'PENDING', to: 'APPROVED' },
              edits,
            }),
            reason: 'Moderator edit and approve',
          },
        });
      });
    } else {
      const sub = await prisma.accessorySubmission.findUniqueOrThrow({
        where: { id },
        select: { submitterId: true, submittedData: true, status: true },
      });
      if (sub.status !== 'PENDING')
        return { success: false, error: 'Submission is not pending' };
      submitterId = sub.submitterId;
      const merged = { ...(sub.submittedData as object), ...edits };
      entityName = getEntityName(merged);

      await prisma.$transaction(async (tx) => {
        await tx.accessorySubmission.update({
          where: { id },
          data: {
            submittedData: toJson(merged),
            status: 'APPROVED',
            decidedById: user.id,
            decidedAt: new Date(),
          },
        });
        await tx.moderationAction.create({
          data: {
            submissionType: 'accessory',
            submissionId: id,
            moderatorId: user.id,
            action: 'APPROVE',
            notes: 'Edit and approve',
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'AccessorySubmission',
            entityId: id,
            action: 'UPDATE',
            changedBy: user.id,
            changes: toJson({
              status: { from: 'PENDING', to: 'APPROVED' },
              edits,
            }),
            reason: 'Moderator edit and approve',
          },
        });
      });
    }

    await handleModerationDecision({
      submitterId,
      submissionId: id,
      kind: type,
      decision: 'APPROVED',
      entityName,
      catalogueUrl: '/account/submissions',
    });

    revalidatePath('/admin/moderation');
    revalidatePath(`/admin/moderation/${id}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to edit and approve',
    };
  }
}
