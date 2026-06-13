'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  validateAndPreviewVehicleCsv,
  type VehicleCsvPreviewResult,
} from '../csv/vehicle-csv';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function previewVehicleUploadAction(
  csvText: string,
): Promise<ActionResult<VehicleCsvPreviewResult>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const preview = validateAndPreviewVehicleCsv(csvText);
    return { success: true, data: preview };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to parse CSV';
    return { success: false, error: msg };
  }
}

export async function commitVehicleUploadAction(
  csvText: string,
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const preview = validateAndPreviewVehicleCsv(csvText);

  if (preview.errorRows > 0) {
    return {
      success: false,
      error: `Cannot commit: ${preview.errorRows} row(s) have validation errors. Fix them before importing.`,
    };
  }

  if (preview.deduplicated.length === 0) {
    return { success: false, error: 'No valid rows to import.' };
  }

  let imported = 0;
  const skipped = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of preview.deduplicated) {
        const makeSlug = slugify(row.makeName);
        const make = await tx.vehicleMake.upsert({
          where: { slug: makeSlug },
          create: {
            name: row.makeName,
            slug: makeSlug,
            countryOfOrigin: row.makeCountryOfOrigin ?? null,
          },
          update: {},
        });

        const modelSlug = slugify(row.modelName);
        const model = await tx.vehicleModel.upsert({
          where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
          create: {
            makeId: make.id,
            name: row.modelName,
            slug: modelSlug,
            bodyType: row.bodyType,
          },
          update: {},
        });

        const variantSlug = slugify(row.variantName);
        await tx.vehicleVariant.upsert({
          where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
          create: {
            modelId: model.id,
            name: row.variantName,
            slug: variantSlug,
            yearFrom: row.yearFrom,
            yearTo: row.yearTo,
            isCurrentProduction: row.isCurrentProduction,
            fuelType: row.fuelType,
            market: row.market,
            gvmKg: row.gvmKg,
            gcmKg: row.gcmKg,
            kerbWeightKg: row.kerbWeightKg,
            maxTowingCapacityKg: row.maxTowingCapacityKg,
            frontAxleLimitKg: row.frontAxleLimitKg,
            rearAxleLimitKg: row.rearAxleLimitKg,
            wheelbaseMm: row.wheelbaseMm,
            frontOverhangMm: row.frontOverhangMm ?? null,
            rearOverhangMm: row.rearOverhangMm ?? null,
            totalLengthMm: row.totalLengthMm ?? null,
            maxTowBallDownloadKg: row.maxTowBallDownloadKg,
            fuelTankCapacityL: row.fuelTankCapacityL,
          },
          update: {
            yearFrom: row.yearFrom,
            yearTo: row.yearTo,
            isCurrentProduction: row.isCurrentProduction,
            fuelType: row.fuelType,
            market: row.market,
            gvmKg: row.gvmKg,
            gcmKg: row.gcmKg,
            kerbWeightKg: row.kerbWeightKg,
            maxTowingCapacityKg: row.maxTowingCapacityKg,
            frontAxleLimitKg: row.frontAxleLimitKg,
            rearAxleLimitKg: row.rearAxleLimitKg,
            wheelbaseMm: row.wheelbaseMm,
            frontOverhangMm: row.frontOverhangMm ?? null,
            rearOverhangMm: row.rearOverhangMm ?? null,
            totalLengthMm: row.totalLengthMm ?? null,
            maxTowBallDownloadKg: row.maxTowBallDownloadKg,
            fuelTankCapacityL: row.fuelTankCapacityL,
          },
        });

        imported++;
      }
    });

    // Audit log — best-effort (won't fail the import if user isn't in DB)
    try {
      await prisma.auditLog.create({
        data: {
          entityType: 'VehicleBulkImport',
          entityId: `bulk-${Date.now()}`,
          action: 'CREATE',
          changedBy: user.id,
          changes: {
            imported,
            skipped,
            inputRows: preview.totalInputRows,
            mergedRows: preview.mergedRows,
          },
        },
      });
    } catch {
      // Silently ignore audit log failures (e.g. dev user not in DB)
    }

    revalidatePath('/admin/catalogue/vehicles');
    return { success: true, data: { imported, skipped } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed';
    return { success: false, error: msg };
  }
}
