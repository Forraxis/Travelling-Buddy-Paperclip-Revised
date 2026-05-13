"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/modules/admin/lib/auth";
import {
  validateAndPreviewCaravanCsv,
  type CaravanCsvPreviewResult,
} from "../csv/caravan-csv";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function previewCaravanUploadAction(
  csvText: string
): Promise<ActionResult<CaravanCsvPreviewResult>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const preview = validateAndPreviewCaravanCsv(csvText);
    return { success: true, data: preview };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to parse CSV";
    return { success: false, error: msg };
  }
}

export async function commitCaravanUploadAction(
  csvText: string
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const preview = validateAndPreviewCaravanCsv(csvText);

  if (preview.errorRows > 0) {
    return {
      success: false,
      error: `Cannot commit: ${preview.errorRows} row(s) have validation errors. Fix them before importing.`,
    };
  }

  if (preview.deduplicated.length === 0) {
    return { success: false, error: "No valid rows to import." };
  }

  let imported = 0;
  let skipped = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of preview.deduplicated) {
        const makeSlug = slugify(row.makeName);
        const make = await tx.caravanMake.upsert({
          where: { slug: makeSlug },
          create: {
            name: row.makeName,
            slug: makeSlug,
            countryOfOrigin: row.makeCountryOfOrigin ?? null,
          },
          update: {},
        });

        const modelSlug = slugify(row.modelName);
        const model = await tx.caravanModel.upsert({
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
        await tx.caravanVariant.upsert({
          where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
          create: {
            modelId: model.id,
            name: row.variantName,
            slug: variantSlug,
            yearFrom: row.yearFrom,
            yearTo: row.yearTo,
            isCurrentProduction: row.isCurrentProduction,
            axleConfiguration: row.axleConfiguration,
            market: row.market,
            atmKg: row.atmKg,
            gtmKg: row.gtmKg,
            tareKg: row.tareKg,
            tbmKg: row.tbmKg,
            couplingToAxleMm: row.couplingToAxleMm,
            axleSpacingMm: row.axleSpacingMm ?? null,
            bodyLengthMm: row.bodyLengthMm,
            overallLengthMm: row.overallLengthMm,
            freshWaterCapacityL: row.freshWaterCapacityL,
            greyWaterCapacityL: row.greyWaterCapacityL,
            gasBottleConfig: row.gasBottleConfig ?? null,
          },
          update: {
            yearFrom: row.yearFrom,
            yearTo: row.yearTo,
            isCurrentProduction: row.isCurrentProduction,
            axleConfiguration: row.axleConfiguration,
            market: row.market,
            atmKg: row.atmKg,
            gtmKg: row.gtmKg,
            tareKg: row.tareKg,
            tbmKg: row.tbmKg,
            couplingToAxleMm: row.couplingToAxleMm,
            axleSpacingMm: row.axleSpacingMm ?? null,
            bodyLengthMm: row.bodyLengthMm,
            overallLengthMm: row.overallLengthMm,
            freshWaterCapacityL: row.freshWaterCapacityL,
            greyWaterCapacityL: row.greyWaterCapacityL,
            gasBottleConfig: row.gasBottleConfig ?? null,
          },
        });

        imported++;
      }
    });

    // Audit log — best-effort
    try {
      await prisma.auditLog.create({
        data: {
          entityType: "CaravanBulkImport",
          entityId: `bulk-${Date.now()}`,
          action: "CREATE",
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

    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: { imported, skipped } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return { success: false, error: msg };
  }
}
