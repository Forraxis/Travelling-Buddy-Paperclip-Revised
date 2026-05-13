"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createCaravanService } from "../services/caravan.service";
import { getAdminUser } from "@/modules/admin/lib/auth";
import type {
  CreateCaravanMakeInput,
  UpdateCaravanMakeInput,
  CreateCaravanModelInput,
  UpdateCaravanModelInput,
  CreateCaravanVariantInput,
  UpdateCaravanVariantInput,
} from "../types/caravan.types";

const caravanService = createCaravanService(prisma);

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function writeAuditLog(
  entityType: string,
  entityId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  changedBy: string,
  changes: object
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

export async function listCaravanMakesAction(cursor?: string, search?: string) {
  if (search) {
    const results = await caravanService.search(search, 50);
    return {
      items: results.makes,
      nextCursor: null,
      hasMore: false,
    };
  }
  return caravanService.listMakes({ cursor, limit: 25 });
}

export async function getCaravanMakeBySlugAction(slug: string) {
  return caravanService.getMakeBySlug(slug);
}

export async function createCaravanMakeAction(
  input: Omit<CreateCaravanMakeInput, "slug">
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const make = await caravanService.createMake({ ...input, slug });
    await writeAuditLog("CaravanMake", make.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: make };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create make";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error: "A make with this name already exists.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateCaravanMakeAction(
  id: string,
  input: UpdateCaravanMakeInput
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const make = await caravanService.updateMake(id, input);
    await writeAuditLog("CaravanMake", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: make };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update make";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error: "A make with this name already exists.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteCaravanMakeAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await caravanService.deleteMake(id);
    await writeAuditLog("CaravanMake", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete make";
    return { success: false, error: msg };
  }
}

// ── Models ─────────────────────────────────────────

export async function listCaravanModelsByMakeAction(
  makeId: string,
  cursor?: string
) {
  return caravanService.listModelsByMake(makeId, { cursor, limit: 25 });
}

export async function getCaravanModelBySlugAction(
  makeSlug: string,
  modelSlug: string
) {
  return caravanService.getModelBySlug(makeSlug, modelSlug);
}

export async function createCaravanModelAction(
  input: Omit<CreateCaravanModelInput, "slug">
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const model = await caravanService.createModel({ ...input, slug });
    await writeAuditLog("CaravanModel", model.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: model };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create model";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error: "A model with this name already exists for this make.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateCaravanModelAction(
  id: string,
  input: UpdateCaravanModelInput
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const model = await caravanService.updateModel(id, input);
    await writeAuditLog("CaravanModel", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: model };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update model";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error: "A model with this name already exists for this make.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteCaravanModelAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await caravanService.deleteModel(id);
    await writeAuditLog("CaravanModel", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete model";
    return { success: false, error: msg };
  }
}

// ── Variants ───────────────────────────────────────

export async function listCaravanVariantsByModelAction(
  modelId: string,
  cursor?: string
) {
  return caravanService.listVariantsByModel(modelId, { cursor, limit: 25 });
}

export async function getCaravanVariantByIdAction(id: string) {
  return caravanService.getVariantById(id);
}

export async function createCaravanVariantAction(
  input: Omit<CreateCaravanVariantInput, "slug">
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const variant = await caravanService.createVariant({ ...input, slug });
    await writeAuditLog("CaravanVariant", variant.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: variant };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create variant";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error:
          "A variant with this name already exists for this model, or the year range overlaps with an existing variant.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function updateCaravanVariantAction(
  id: string,
  input: UpdateCaravanVariantInput
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const variant = await caravanService.updateVariant(id, input);
    await writeAuditLog("CaravanVariant", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: variant };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update variant";
    if (msg.includes("Unique constraint")) {
      return {
        success: false,
        error:
          "A variant with this name already exists for this model, or the year range overlaps.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function deleteCaravanVariantAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await caravanService.deleteVariant(id);
    await writeAuditLog("CaravanVariant", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete variant";
    return { success: false, error: msg };
  }
}

// ── Admin range actions ─────────────────────────────

function yearRangeSlug(nameSlug: string, yearFrom: number, yearTo: number): string {
  return `${nameSlug}-${yearFrom}-${yearTo}`;
}

async function checkCaravanOverlap(
  modelId: string,
  yearFrom: number,
  yearTo: number,
  excludeId?: string
): Promise<{ yearFrom: number; yearTo: number } | null> {
  return prisma.caravanVariant.findFirst({
    where: {
      modelId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      yearFrom: { lte: yearTo },
      yearTo: { gte: yearFrom },
    },
    select: { yearFrom: true, yearTo: true },
  });
}

export async function splitCaravanVariantRangeAction(
  variantId: string,
  anomalyYearFrom: number,
  anomalyYearTo: number
): Promise<ActionResult<{ created: number; variantIds: string[] }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const source = await prisma.caravanVariant.findUniqueOrThrow({
      where: { id: variantId },
    });

    if (anomalyYearFrom < source.yearFrom || anomalyYearTo > source.yearTo) {
      return { success: false, error: "Anomaly range must be within the existing variant range" };
    }
    if (anomalyYearFrom > anomalyYearTo) {
      return { success: false, error: "Anomaly year from must be ≤ year to" };
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
        const created = await tx.caravanVariant.create({
          data: {
            modelId: source.modelId,
            yearFrom: seg.yearFrom,
            yearTo: seg.yearTo,
            isCurrentProduction: false,
            name: source.name,
            slug: segSlug,
            status: source.status,
            atmKg: source.atmKg,
            gtmKg: source.gtmKg,
            tareKg: source.tareKg,
            tbmKg: source.tbmKg,
            axleConfiguration: source.axleConfiguration,
            couplingToAxleMm: source.couplingToAxleMm,
            axleSpacingMm: source.axleSpacingMm,
            bodyLengthMm: source.bodyLengthMm,
            overallLengthMm: source.overallLengthMm,
            freshWaterCapacityL: source.freshWaterCapacityL,
            greyWaterCapacityL: source.greyWaterCapacityL,
            gasBottleConfig: source.gasBottleConfig,
            market: source.market,
          },
        });
        createdIds.push(created.id);
        await tx.auditLog.create({
          data: {
            entityType: "CaravanVariant",
            entityId: created.id,
            action: "CREATE",
            changedBy: user.id,
            changes: { splitFrom: variantId, yearFrom: seg.yearFrom, yearTo: seg.yearTo },
          },
        });
      }
      await tx.caravanVariant.delete({ where: { id: variantId } });
      await tx.auditLog.create({
        data: {
          entityType: "CaravanVariant",
          entityId: variantId,
          action: "DELETE",
          changedBy: user.id,
          changes: { reason: "split", anomalyYearFrom, anomalyYearTo, replacedBy: createdIds },
        },
      });
    });

    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: { created: segments.length, variantIds: createdIds } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to split variant range";
    return { success: false, error: msg };
  }
}

export async function advanceCaravanYearToAction(
  variantId: string,
  newYearTo: number
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const source = await prisma.caravanVariant.findUniqueOrThrow({ where: { id: variantId } });

    if (newYearTo <= source.yearTo) {
      return { success: false, error: "New year to must be greater than current year to" };
    }

    const overlap = await checkCaravanOverlap(source.modelId, source.yearFrom, newYearTo, variantId);
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
      await tx.caravanVariant.update({
        where: { id: variantId },
        data: { yearTo: newYearTo, isCurrentProduction: false, slug: newSlug },
      });
      if (oldSlug !== newSlug) {
        await tx.variantSlugRedirect.create({
          data: {
            entityType: "CaravanVariant",
            entityId: variantId,
            modelId: source.modelId,
            fromSlug: oldSlug,
            toSlug: newSlug,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: "CaravanVariant",
          entityId: variantId,
          action: "UPDATE",
          changedBy: user.id,
          changes: {
            yearTo: { from: source.yearTo, to: newYearTo },
            slug: { from: oldSlug, to: newSlug },
          },
        },
      });
    });

    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to advance year to";
    return { success: false, error: msg };
  }
}

export async function closeCaravanCurrentProductionAction(
  variantId: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const source = await prisma.caravanVariant.findUniqueOrThrow({ where: { id: variantId } });

    if (!source.isCurrentProduction) {
      return { success: false, error: "Variant is not marked as current production" };
    }

    const currentYear = new Date().getFullYear();
    const nameSlug = slugify(source.name);
    const oldSlug = source.slug;
    const newSlug = yearRangeSlug(nameSlug, source.yearFrom, currentYear);

    await prisma.$transaction(async (tx) => {
      await tx.caravanVariant.update({
        where: { id: variantId },
        data: { isCurrentProduction: false, yearTo: currentYear, slug: newSlug },
      });
      if (oldSlug !== newSlug) {
        await tx.variantSlugRedirect.create({
          data: {
            entityType: "CaravanVariant",
            entityId: variantId,
            modelId: source.modelId,
            fromSlug: oldSlug,
            toSlug: newSlug,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          entityType: "CaravanVariant",
          entityId: variantId,
          action: "UPDATE",
          changedBy: user.id,
          changes: {
            isCurrentProduction: { from: true, to: false },
            yearTo: { from: source.yearTo, to: currentYear },
            slug: { from: oldSlug, to: newSlug },
          },
        },
      });
    });

    revalidatePath("/admin/catalogue/caravans");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to close current production";
    return { success: false, error: msg };
  }
}
