"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/modules/admin/lib/auth";
import {
  validateAndPreviewFitmentCsv,
  type FitmentCsvPreviewResult,
  type FitmentCsvRowParsed,
} from "../csv/fitment-csv";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Resolve a variant slug path "make-slug/model-slug/variant-slug" for vehicles
async function resolveVehicleVariant(
  slugPath: string
): Promise<string | null> {
  const parts = slugPath.split("/");
  if (parts.length !== 3) return null;
  const [makeSlug, modelSlug, variantSlug] = parts;
  const variant = await prisma.vehicleVariant.findFirst({
    where: {
      slug: variantSlug,
      model: { slug: modelSlug, make: { slug: makeSlug } },
    },
    select: { id: true },
  });
  return variant?.id ?? null;
}

// Resolve a variant slug path "make-slug/model-slug/variant-slug" for caravans
async function resolveCaravanVariant(
  slugPath: string
): Promise<string | null> {
  const parts = slugPath.split("/");
  if (parts.length !== 3) return null;
  const [makeSlug, modelSlug, variantSlug] = parts;
  const variant = await prisma.caravanVariant.findFirst({
    where: {
      slug: variantSlug,
      model: { slug: modelSlug, make: { slug: makeSlug } },
    },
    select: { id: true },
  });
  return variant?.id ?? null;
}

// Resolve an accessory by brand-slug + accessory-slug
async function resolveAccessory(
  brandName: string,
  accessorySlug: string
): Promise<string | null> {
  const brandSlug = slugify(brandName);
  const brand = await prisma.accessoryBrand.findUnique({
    where: { slug: brandSlug },
    select: { id: true },
  });
  if (!brand) return null;

  const accessory = await prisma.accessory.findUnique({
    where: { brandId_slug: { brandId: brand.id, slug: accessorySlug } },
    select: { id: true },
  });
  return accessory?.id ?? null;
}

export async function previewFitmentUploadAction(
  csvText: string
): Promise<ActionResult<FitmentCsvPreviewResult>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const preview = validateAndPreviewFitmentCsv(csvText);
    return { success: true, data: preview };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to parse CSV";
    return { success: false, error: msg };
  }
}

export async function commitFitmentUploadAction(
  csvText: string
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const preview = validateAndPreviewFitmentCsv(csvText);

  if (preview.errorRows > 0) {
    return {
      success: false,
      error: `Cannot commit: ${preview.errorRows} row(s) have validation errors.`,
    };
  }

  const validRows = preview.rows
    .filter((r) => r.parsed)
    .map((r) => r.parsed!);

  if (validRows.length === 0) {
    return { success: false, error: "No valid rows to import." };
  }

  // Resolve all variant + accessory IDs before opening the transaction
  type ResolvedRow = {
    row: FitmentCsvRowParsed;
    accessoryId: string;
    vehicleVariantId: string | null;
    caravanVariantId: string | null;
    rowNumber: number;
  };

  const resolved: ResolvedRow[] = [];
  const resolutionErrors: string[] = [];

  for (let i = 0; i < preview.rows.length; i++) {
    const result = preview.rows[i];
    if (!result.parsed) continue;
    const row = result.parsed;
    const rowNum = result.rowNumber;

    const accessoryId = await resolveAccessory(row.brandName, row.accessorySlug);
    if (!accessoryId) {
      resolutionErrors.push(
        `Row ${rowNum}: accessory "${row.accessorySlug}" not found for brand "${row.brandName}"`
      );
      continue;
    }

    let vehicleVariantId: string | null = null;
    let caravanVariantId: string | null = null;

    if (row.vehicleVariantSlug) {
      vehicleVariantId = await resolveVehicleVariant(row.vehicleVariantSlug);
      if (!vehicleVariantId) {
        resolutionErrors.push(
          `Row ${rowNum}: vehicle variant "${row.vehicleVariantSlug}" not found (expected make-slug/model-slug/variant-slug)`
        );
        continue;
      }
    } else if (row.caravanVariantSlug) {
      caravanVariantId = await resolveCaravanVariant(row.caravanVariantSlug);
      if (!caravanVariantId) {
        resolutionErrors.push(
          `Row ${rowNum}: caravan variant "${row.caravanVariantSlug}" not found (expected make-slug/model-slug/variant-slug)`
        );
        continue;
      }
    }

    resolved.push({ row, accessoryId, vehicleVariantId, caravanVariantId, rowNumber: rowNum });
  }

  if (resolutionErrors.length > 0) {
    return {
      success: false,
      error: resolutionErrors.join("\n"),
    };
  }

  let imported = 0;
  let skipped = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const { row, accessoryId, vehicleVariantId, caravanVariantId } of resolved) {
        // Check for an existing identical fitment (same accessory + same variant + mounting_location)
        const existing = await tx.accessoryFitment.findFirst({
          where: {
            accessoryId,
            vehicleVariantId: vehicleVariantId ?? undefined,
            caravanVariantId: caravanVariantId ?? undefined,
            mountingLocation: row.mountingLocation,
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.accessoryFitment.create({
          data: {
            accessoryId,
            vehicleVariantId,
            caravanVariantId,
            installedWeightKg: row.installedWeightKg,
            positionType: row.positionType,
            mountingLocation: row.mountingLocation,
            providesMountingLocations: row.providesMountingLocations,
            cogXMm: row.cogXMm,
            startXMm: row.startXMm,
            endXMm: row.endXMm,
            mountOffsetXMm: row.mountOffsetXMm,
            tankContentsKgPerL: row.fluidDensity,
            source: "OEM",
          },
        });
        imported++;
      }
    });

    // Audit log — best-effort
    try {
      await prisma.auditLog.create({
        data: {
          entityType: "FitmentBulkImport",
          entityId: `bulk-${Date.now()}`,
          action: "CREATE",
          changedBy: user.id,
          changes: {
            imported,
            skipped,
            inputRows: preview.totalInputRows,
          },
        },
      });
    } catch {
      // Silently ignore audit log failures in dev
    }

    revalidatePath("/admin/catalogue/accessories");
    return { success: true, data: { imported, skipped } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return { success: false, error: msg };
  }
}
