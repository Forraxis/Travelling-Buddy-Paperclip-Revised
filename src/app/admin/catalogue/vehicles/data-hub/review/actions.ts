'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';

const REVIEW_PATH = '/admin/catalogue/vehicles/data-hub/review';
const HUB_PATH = '/admin/catalogue/vehicles/data-hub';

export interface SetBaseIdentityInput {
  id: string;
  baseMake: string;
  baseModel: string;
  /** Optional second-stage modifier ("Premcar", "Ironman"…). Empty clears it. */
  modifier?: string;
}

export interface SetBaseIdentityResult {
  success: boolean;
  error?: string;
}

/**
 * P10 — NEEDS_REVIEW curation. Lets an admin manually resolve the base identity of a
 * ROVER approval row that the normalizer (P3) couldn't disambiguate confidently. Sets
 * baseMake/baseModel (+ optional modifier) and flips normalizationStatus → MANUAL so the
 * row leaves the review queue and is never auto-overwritten. Audit-logged.
 */
export async function setBaseIdentityAction(
  input: SetBaseIdentityInput,
): Promise<SetBaseIdentityResult> {
  const adminUser = await getAdminUser();
  if (!adminUser) return { success: false, error: 'Unauthorized' };

  const baseMake = input.baseMake.trim();
  const baseModel = input.baseModel.trim();
  const modifier = (input.modifier ?? '').trim();

  if (!baseMake) return { success: false, error: 'Base make is required' };
  if (!baseModel) return { success: false, error: 'Base model is required' };

  const existing = await prisma.roverApprovalIndex.findUnique({
    where: { id: input.id },
    select: {
      vtaNumber: true,
      baseMake: true,
      baseModel: true,
      modifier: true,
      normalizationStatus: true,
    },
  });
  if (!existing) return { success: false, error: 'Row not found' };

  await prisma.$transaction(async (tx) => {
    await tx.roverApprovalIndex.update({
      where: { id: input.id },
      data: {
        baseMake,
        baseModel,
        modifier: modifier || null,
        normalizationStatus: 'MANUAL',
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'RoverApprovalIndex',
        entityId: input.id,
        action: 'UPDATE',
        changedBy: adminUser.id,
        changes: {
          old: {
            baseMake: existing.baseMake,
            baseModel: existing.baseModel,
            modifier: existing.modifier,
            normalizationStatus: existing.normalizationStatus,
          },
          new: {
            baseMake,
            baseModel,
            modifier: modifier || null,
            normalizationStatus: 'MANUAL',
          },
        },
        reason: `Manual base-identity curation for ${existing.vtaNumber} (NEEDS_REVIEW → MANUAL)`,
      },
    });
  });

  revalidatePath(REVIEW_PATH);
  revalidatePath(HUB_PATH);

  return { success: true };
}
