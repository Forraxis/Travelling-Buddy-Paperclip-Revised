'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  gvmUpgradeAdminSchema,
  type GvmUpgradeAdminInput,
  type GvmUpgradeKitDto,
} from '../types';

type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

/** A base variant + its current GVM-upgrade count, for the admin index. */
export interface BaseVariantWithUpgradesDto {
  variantId: string;
  makeName: string;
  modelName: string;
  variantName: string;
  yearFrom: number;
  yearTo: number;
  gvmKg: number | null;
  upgradeCount: number;
}

function toKitDto(row: {
  id: string;
  baseVariantId: string;
  modifierName: string;
  pathway: GvmUpgradeKitDto['pathway'];
  vtaNumber: string | null;
  engineerRef: string | null;
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingKg: number | null;
  addedMassKg: number | null;
  isPreRego: boolean;
  certifiedState: GvmUpgradeKitDto['certifiedState'];
  status: GvmUpgradeKitDto['status'];
  sourceUrl: string | null;
  sourceVtaNumber: string | null;
}): GvmUpgradeKitDto {
  return {
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
  };
}

/**
 * Base variants that have at least one GVM upgrade attached, plus a search
 * fallback so admins can find a variant to attach a new kit to. Catalogue
 * variants only (a GVM upgrade attaches to a real base vehicle).
 */
export async function listBaseVariantsWithUpgradesAction(
  search?: string,
): Promise<BaseVariantWithUpgradesDto[]> {
  const user = await getAdminUser();
  if (!user) return [];

  const term = search?.trim();
  const variants = await prisma.vehicleVariant.findMany({
    where: {
      status: 'CATALOGUE',
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { model: { name: { contains: term, mode: 'insensitive' } } },
              {
                model: {
                  make: { name: { contains: term, mode: 'insensitive' } },
                },
              },
            ],
          }
        : { gvmUpgrades: { some: {} } }),
    },
    select: {
      id: true,
      name: true,
      yearFrom: true,
      yearTo: true,
      gvmKg: true,
      model: { select: { name: true, make: { select: { name: true } } } },
      _count: { select: { gvmUpgrades: true } },
    },
    orderBy: [{ model: { make: { name: 'asc' } } }, { name: 'asc' }],
    take: 200,
  });

  return variants.map((v) => ({
    variantId: v.id,
    makeName: v.model.make.name,
    modelName: v.model.name,
    variantName: v.name,
    yearFrom: v.yearFrom,
    yearTo: v.yearTo,
    gvmKg: v.gvmKg,
    upgradeCount: v._count.gvmUpgrades,
  }));
}

/** Identity + factory limits for a base variant (the manage-upgrades header). */
export async function getBaseVariantAction(variantId: string): Promise<{
  variantId: string;
  makeName: string;
  modelName: string;
  variantName: string;
  yearFrom: number;
  yearTo: number;
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingCapacityKg: number | null;
} | null> {
  const user = await getAdminUser();
  if (!user) return null;

  const v = await prisma.vehicleVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      name: true,
      yearFrom: true,
      yearTo: true,
      gvmKg: true,
      gcmKg: true,
      frontAxleLimitKg: true,
      rearAxleLimitKg: true,
      maxTowingCapacityKg: true,
      model: { select: { name: true, make: { select: { name: true } } } },
    },
  });
  if (!v) return null;
  return {
    variantId: v.id,
    makeName: v.model.make.name,
    modelName: v.model.name,
    variantName: v.name,
    yearFrom: v.yearFrom,
    yearTo: v.yearTo,
    gvmKg: v.gvmKg,
    gcmKg: v.gcmKg,
    frontAxleLimitKg: v.frontAxleLimitKg,
    rearAxleLimitKg: v.rearAxleLimitKg,
    maxTowingCapacityKg: v.maxTowingCapacityKg,
  };
}

/** Every GVM upgrade attached to a base variant (admin manage list). */
export async function listGvmUpgradesForVariantAction(
  variantId: string,
): Promise<GvmUpgradeKitDto[]> {
  const user = await getAdminUser();
  if (!user) return [];
  const rows = await prisma.gvmUpgrade.findMany({
    where: { baseVariantId: variantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toKitDto);
}

export async function createGvmUpgradeAction(
  variantId: string,
  input: GvmUpgradeAdminInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = gvmUpgradeAdminSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const base = await prisma.vehicleVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!base) return { success: false, error: 'Base variant not found' };

  try {
    await prisma.gvmUpgrade.create({
      data: { baseVariantId: variantId, status: 'CATALOGUE', ...parsed.data },
    });
    revalidatePath(`/admin/catalogue/gvm-upgrades/${variantId}`);
    revalidatePath('/admin/catalogue/gvm-upgrades');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function updateGvmUpgradeAction(
  upgradeId: string,
  input: GvmUpgradeAdminInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = gvmUpgradeAdminSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const updated = await prisma.gvmUpgrade.update({
      where: { id: upgradeId },
      data: parsed.data,
      select: { baseVariantId: true },
    });
    revalidatePath(`/admin/catalogue/gvm-upgrades/${updated.baseVariantId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function deleteGvmUpgradeAction(
  upgradeId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const deleted = await prisma.gvmUpgrade.delete({
      where: { id: upgradeId },
      select: { baseVariantId: true },
    });
    revalidatePath(`/admin/catalogue/gvm-upgrades/${deleted.baseVariantId}`);
    revalidatePath('/admin/catalogue/gvm-upgrades');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed' };
  }
}
