'use server';

import { prisma } from '@/lib/db';
import type { GvmUpgradeKitDto } from '../types';

/**
 * Catalogue GVM-upgrade kits available for a given base vehicle variant, for the
 * calculator/setup "Have a GVM upgrade?" picker. CATALOGUE status only (admin- or
 * ROVER-promoted kits) — community/pending kits are not offered here.
 *
 * Rule 11: selecting a kit only *records* it on the setup; the verdict-affecting
 * overlay stays behind `GVM_UPGRADE_ENABLED` + advisory (see disclaimer.ts).
 */
export async function listGvmUpgradesForVehicleAction(
  variantId: string,
): Promise<GvmUpgradeKitDto[]> {
  if (!variantId) return [];
  const rows = await prisma.gvmUpgrade.findMany({
    where: { baseVariantId: variantId, status: 'CATALOGUE' },
    orderBy: { modifierName: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    baseVariantId: row.baseVariantId,
    modifierName: row.modifierName,
    pathway: row.pathway,
    vtaNumber: row.vtaNumber,
    engineerRef: row.engineerRef,
    gvmKg: row.gvmKg,
    gcmKg: row.gcmKg,
    frontAxleLimitKg: row.frontAxleLimitKg,
    rearAxleLimitKg: row.rearAxleLimitKg,
    maxTowingKg: row.maxTowingKg,
    addedMassKg: row.addedMassKg,
    isPreRego: row.isPreRego,
    certifiedState: row.certifiedState,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sourceVtaNumber: row.sourceVtaNumber,
  }));
}
