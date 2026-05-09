"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/modules/admin/lib/auth";
import {
  validateAndPreviewAccessoryCsv,
  type AccessoryCsvPreviewResult,
} from "../csv/accessory-csv";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function previewAccessoryUploadAction(
  csvText: string
): Promise<ActionResult<AccessoryCsvPreviewResult>> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const preview = validateAndPreviewAccessoryCsv(csvText);
    return { success: true, data: preview };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to parse CSV";
    return { success: false, error: msg };
  }
}

export async function commitAccessoryUploadAction(
  csvText: string
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const preview = validateAndPreviewAccessoryCsv(csvText);

  if (preview.errorRows > 0) {
    return {
      success: false,
      error: `Cannot commit: ${preview.errorRows} row(s) have validation errors.`,
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
        // Upsert brand
        const brandSlug = slugify(row.brandName);
        const brand = await tx.accessoryBrand.upsert({
          where: { slug: brandSlug },
          create: { name: row.brandName, slug: brandSlug },
          update: {},
        });

        // Upsert category (top-level, no parent)
        const categorySlug = slugify(row.categoryName);
        const category = await tx.accessoryCategory.upsert({
          where: { slug: categorySlug },
          create: { name: row.categoryName, slug: categorySlug },
          update: {},
        });

        // Upsert accessory (unique by brandId + slug)
        const existing = await tx.accessory.findUnique({
          where: { brandId_slug: { brandId: brand.id, slug: row.slug } },
        });

        if (existing) {
          skipped++;
        } else {
          await tx.accessory.create({
            data: {
              brandId: brand.id,
              categoryId: category.id,
              name: row.name,
              slug: row.slug,
              description: row.description,
              status: row.status,
            },
          });
          imported++;
        }
      }
    });

    // Audit log — best-effort
    try {
      await prisma.auditLog.create({
        data: {
          entityType: "AccessoryBulkImport",
          entityId: `bulk-${Date.now()}`,
          action: "CREATE",
          changedBy: user.id,
          changes: {
            imported,
            skipped,
            inputRows: preview.totalInputRows,
            duplicateRows: preview.duplicateRows,
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
