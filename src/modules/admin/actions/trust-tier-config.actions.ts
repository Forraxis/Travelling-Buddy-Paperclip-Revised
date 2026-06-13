'use server';

import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  getTrustTierConfig,
  invalidateTrustTierConfigCache,
  type TrustTierConfig,
} from '@/lib/trust-tier';

export type { TrustTierConfig };

export async function getTrustTierConfigAction(): Promise<TrustTierConfig> {
  const adminUser = await getAdminUser();
  if (!adminUser) throw new Error('Unauthorized');
  return getTrustTierConfig();
}

export interface SaveTrustTierConfigResult {
  success: boolean;
  error?: string;
}

export async function saveTrustTierConfigAction(
  incoming: TrustTierConfig,
): Promise<SaveTrustTierConfigResult> {
  const adminUser = await getAdminUser();
  if (!adminUser) return { success: false, error: 'Unauthorized' };
  if (adminUser.role !== 'ADMIN')
    return { success: false, error: 'Forbidden: ADMIN role required' };

  // Validate: all values must be positive integers
  for (const [key, val] of Object.entries(incoming)) {
    if (!Number.isInteger(val) || val <= 0) {
      return {
        success: false,
        error: `${key} must be a positive integer`,
      };
    }
  }

  const oldConfig = await getTrustTierConfig();

  const keys = Object.keys(incoming) as (keyof TrustTierConfig)[];

  await prisma.$transaction(async (tx) => {
    for (const key of keys) {
      await tx.adminConfig.upsert({
        where: { key },
        create: { key, value: incoming[key], updatedById: adminUser.id },
        update: { value: incoming[key], updatedById: adminUser.id },
      });
    }

    await tx.auditLog.create({
      data: {
        entityType: 'AdminConfig',
        entityId: 'trust-tier-thresholds',
        action: 'UPDATE',
        changedBy: adminUser.id,
        changes: {
          old: oldConfig,
          new: incoming,
        },
        reason: 'Trust tier thresholds updated via admin settings',
      },
    });
  });

  invalidateTrustTierConfigCache();

  return { success: true };
}
