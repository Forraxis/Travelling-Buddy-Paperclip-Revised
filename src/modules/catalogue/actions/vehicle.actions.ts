'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { createVehicleService } from '../services/vehicle.service';
import { getAdminUser } from '@/modules/admin/lib/auth';
import type {
  CreateVehicleMakeInput,
  UpdateVehicleMakeInput,
  CreateVehicleModelInput,
  UpdateVehicleModelInput,
  CreateVehicleVariantInput,
  UpdateVehicleVariantInput,
} from '../types/vehicle.types';

const vehicleService = createVehicleService(prisma);

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Build-source splits are concurrent (same name + years, different plant), so the
// slug must carry the build origin to stay unique per model (e.g.
// `st-x-dual-cab-4x4-es` vs `-th`). Non-split variants keep their plain slug.
function variantSlug(name: string, buildOrigin?: string | null): string {
  const base = slugify(name);
  return buildOrigin ? `${base}-${buildOrigin.toLowerCase()}` : base;
}

async function writeAuditLog(
  entityType: string,
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changedBy: string,
  changes: object,
) {
  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changedBy,
      changes: JSON.parse(JSON.stringify(changes)),
    },
  });
}

// ── Makes ──────────────────────────────────────────

export async function listMakesAction(cursor?: string, search?: string) {
  if (search) {
    const results = await vehicleService.search(search, 50);
    return {
      items: results.makes,
      nextCursor: null,
      hasMore: false,
    };
  }
  return vehicleService.listMakes({ cursor, limit: 25 });
}

export async function getMakeBySlugAction(slug: string) {
  return vehicleService.getMakeBySlug(slug);
}

export async function createMakeAction(
  input: Omit<CreateVehicleMakeInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const slug = slugify(input.name);
    const make = await vehicleService.createMake({ ...input, slug });
    await writeAuditLog('VehicleMake', make.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: make };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create make';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error: 'A make with this name already exists.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateMakeAction(
  id: string,
  input: UpdateVehicleMakeInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const make = await vehicleService.updateMake(id, input);
    await writeAuditLog('VehicleMake', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: make };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update make';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error: 'A make with this name already exists.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteMakeAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    await vehicleService.deleteMake(id);
    await writeAuditLog('VehicleMake', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete make';
    return { success: false, error: msg };
  }
}

// ── Models ─────────────────────────────────────────

export async function listModelsByMakeAction(makeId: string, cursor?: string) {
  return vehicleService.listModelsByMake(makeId, { cursor, limit: 25 });
}

export async function getModelBySlugAction(
  makeSlug: string,
  modelSlug: string,
) {
  return vehicleService.getModelBySlug(makeSlug, modelSlug);
}

export async function createModelAction(
  input: Omit<CreateVehicleModelInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const slug = slugify(input.name);
    const model = await vehicleService.createModel({ ...input, slug });
    await writeAuditLog('VehicleModel', model.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: model };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create model';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error: 'A model with this name already exists for this make.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateModelAction(
  id: string,
  input: UpdateVehicleModelInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const model = await vehicleService.updateModel(id, input);
    await writeAuditLog('VehicleModel', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: model };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update model';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error: 'A model with this name already exists for this make.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteModelAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    await vehicleService.deleteModel(id);
    await writeAuditLog('VehicleModel', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete model';
    return { success: false, error: msg };
  }
}

// ── Variants ───────────────────────────────────────

export async function listVariantsByModelAction(
  modelId: string,
  cursor?: string,
) {
  return vehicleService.listVariantsByModel(modelId, { cursor, limit: 25 });
}

export async function getVariantByIdAction(id: string) {
  return vehicleService.getVariantById(id);
}

export async function createVariantAction(
  input: Omit<CreateVehicleVariantInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const slug = variantSlug(input.name, input.buildOrigin);
    const variant = await vehicleService.createVariant({ ...input, slug });
    await writeAuditLog('VehicleVariant', variant.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: variant };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create variant';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error:
          'A variant with this name already exists for this model, or the year range overlaps with an existing variant.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateVariantAction(
  id: string,
  input: UpdateVehicleVariantInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    if (input.name && !input.slug) {
      input.slug = variantSlug(input.name, input.buildOrigin);
    }
    const variant = await vehicleService.updateVariant(id, input);
    await writeAuditLog('VehicleVariant', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: variant };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update variant';
    if (msg.includes('Unique constraint')) {
      return {
        success: false,
        error:
          'A variant with this name already exists for this model, or the year range overlaps.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteVariantAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    await vehicleService.deleteVariant(id);
    await writeAuditLog('VehicleVariant', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete variant';
    return { success: false, error: msg };
  }
}

// ── Admin range actions ─────────────────────────────

function yearRangeSlug(
  nameSlug: string,
  yearFrom: number,
  yearTo: number,
): string {
  return `${nameSlug}-${yearFrom}-${yearTo}`;
}

function currentProductionSlug(nameSlug: string, yearFrom: number): string {
  return `${nameSlug}-${yearFrom}-current`;
}

async function checkOverlap(
  modelId: string,
  yearFrom: number,
  yearTo: number,
  excludeId?: string,
): Promise<{ yearFrom: number; yearTo: number } | null> {
  return prisma.vehicleVariant.findFirst({
    where: {
      modelId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      yearFrom: { lte: yearTo },
      yearTo: { gte: yearFrom },
    },
    select: { yearFrom: true, yearTo: true },
  });
}

export async function splitVariantRangeAction(
  variantId: string,
  anomalyYearFrom: number,
  anomalyYearTo: number,
): Promise<ActionResult<{ created: number; variantIds: string[] }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const source = await prisma.vehicleVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    if (anomalyYearFrom < source.yearFrom || anomalyYearTo > source.yearTo) {
      return {
        success: false,
        error: 'Anomaly range must be within the existing variant range',
      };
    }
    if (anomalyYearFrom > anomalyYearTo) {
      return { success: false, error: 'Anomaly year from must be ≤ year to' };
    }

    const nameSlug = slugify(source.name);
    const segments: Array<{ yearFrom: number; yearTo: number }> = [];

    if (anomalyYearFrom > source.yearFrom) {
      segments.push({ yearFrom: source.yearFrom, yearTo: anomalyYearFrom - 1 });
    }
    segments.push({ yearFrom: anomalyYearFrom, yearTo: anomalyYearTo });
    if (anomalyYearTo < source.yearTo) {
      segments.push({ yearFrom: anomalyYearTo + 1, yearTo: source.yearTo });
    }

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const seg of segments) {
        const segSlug = yearRangeSlug(nameSlug, seg.yearFrom, seg.yearTo);
        const created = await tx.vehicleVariant.create({
          data: {
            modelId: source.modelId,
            yearFrom: seg.yearFrom,
            yearTo: seg.yearTo,
            isCurrentProduction: false,
            name: source.name,
            slug: segSlug,
            status: source.status,
            gvmKg: source.gvmKg,
            gcmKg: source.gcmKg,
            kerbWeightKg: source.kerbWeightKg,
            maxTowingCapacityKg: source.maxTowingCapacityKg,
            frontAxleLimitKg: source.frontAxleLimitKg,
            rearAxleLimitKg: source.rearAxleLimitKg,
            wheelbaseMm: source.wheelbaseMm,
            frontOverhangMm: source.frontOverhangMm,
            rearOverhangMm: source.rearOverhangMm,
            totalLengthMm: source.totalLengthMm,
            maxTowBallDownloadKg: source.maxTowBallDownloadKg,
            fuelTankCapacityL: source.fuelTankCapacityL,
            fuelType: source.fuelType,
            market: source.market,
          },
        });
        createdIds.push(created.id);
        await tx.auditLog.create({
          data: {
            entityType: 'VehicleVariant',
            entityId: created.id,
            action: 'CREATE',
            changedBy: user.id,
            changes: {
              splitFrom: variantId,
              yearFrom: seg.yearFrom,
              yearTo: seg.yearTo,
            },
          },
        });
      }
      await tx.vehicleVariant.delete({ where: { id: variantId } });
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleVariant',
          entityId: variantId,
          action: 'DELETE',
          changedBy: user.id,
          changes: {
            reason: 'split',
            anomalyYearFrom,
            anomalyYearTo,
            replacedBy: createdIds,
          },
        },
      });
    });

    revalidatePath('/admin/catalogue/vehicles');
    return {
      success: true,
      data: { created: segments.length, variantIds: createdIds },
    };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : 'Failed to split variant range';
    return { success: false, error: msg };
  }
}

export async function advanceYearToAction(
  variantId: string,
  newYearTo: number,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const source = await prisma.vehicleVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    if (newYearTo <= source.yearTo) {
      return {
        success: false,
        error: 'New year to must be greater than current year to',
      };
    }

    const overlap = await checkOverlap(
      source.modelId,
      source.yearFrom,
      newYearTo,
      variantId,
    );
    if (overlap) {
      return {
        success: false,
        error: `This range overlaps with an existing variant covering ${overlap.yearFrom}–${overlap.yearTo}`,
      };
    }

    const nameSlug = slugify(source.name);
    const oldSlug = source.slug;
    const newSlug = yearRangeSlug(nameSlug, source.yearFrom, newYearTo);

    await prisma.$transaction(async (tx) => {
      await tx.vehicleVariant.update({
        where: { id: variantId },
        data: { yearTo: newYearTo, isCurrentProduction: false, slug: newSlug },
      });
      if (oldSlug !== newSlug) {
        await tx.variantSlugRedirect.create({
          data: {
            entityType: 'VehicleVariant',
            entityId: variantId,
            modelId: source.modelId,
            fromSlug: oldSlug,
            toSlug: newSlug,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleVariant',
          entityId: variantId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: {
            yearTo: { from: source.yearTo, to: newYearTo },
            slug: { from: oldSlug, to: newSlug },
          },
        },
      });
    });

    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to advance year to';
    return { success: false, error: msg };
  }
}

export async function closeCurrentProductionAction(
  variantId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const source = await prisma.vehicleVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    if (!source.isCurrentProduction) {
      return {
        success: false,
        error: 'Variant is not marked as current production',
      };
    }

    const currentYear = new Date().getFullYear();
    const nameSlug = slugify(source.name);
    const oldSlug = source.slug;
    const newSlug = yearRangeSlug(nameSlug, source.yearFrom, currentYear);

    await prisma.$transaction(async (tx) => {
      await tx.vehicleVariant.update({
        where: { id: variantId },
        data: {
          isCurrentProduction: false,
          yearTo: currentYear,
          slug: newSlug,
        },
      });
      if (oldSlug !== newSlug) {
        await tx.variantSlugRedirect.create({
          data: {
            entityType: 'VehicleVariant',
            entityId: variantId,
            modelId: source.modelId,
            fromSlug: oldSlug,
            toSlug: newSlug,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleVariant',
          entityId: variantId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: {
            isCurrentProduction: { from: true, to: false },
            yearTo: { from: source.yearTo, to: currentYear },
            slug: { from: oldSlug, to: newSlug },
          },
        },
      });
    });

    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : 'Failed to close current production';
    return { success: false, error: msg };
  }
}

export async function getVariantOverlapAction(
  modelId: string,
  yearFrom: number,
  yearTo: number,
  excludeId?: string,
): Promise<ActionResult<{ yearFrom: number; yearTo: number } | null>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const overlap = await checkOverlap(modelId, yearFrom, yearTo, excludeId);
  return { success: true, data: overlap };
}
