"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createVehicleService } from "../services/vehicle.service";
import { getAdminUser } from "@/modules/admin/lib/auth";
import type {
  CreateVehicleMakeInput,
  UpdateVehicleMakeInput,
  CreateVehicleModelInput,
  UpdateVehicleModelInput,
  CreateVehicleVariantInput,
  UpdateVehicleVariantInput,
} from "../types/vehicle.types";

const vehicleService = createVehicleService(prisma);

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
  input: Omit<CreateVehicleMakeInput, "slug">
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const make = await vehicleService.createMake({ ...input, slug });
    await writeAuditLog("VehicleMake", make.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/vehicles");
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

export async function updateMakeAction(
  id: string,
  input: UpdateVehicleMakeInput
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const make = await vehicleService.updateMake(id, input);
    await writeAuditLog("VehicleMake", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/vehicles");
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

export async function deleteMakeAction(id: string): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await vehicleService.deleteMake(id);
    await writeAuditLog("VehicleMake", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/vehicles");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete make";
    return { success: false, error: msg };
  }
}

// ── Models ─────────────────────────────────────────

export async function listModelsByMakeAction(
  makeId: string,
  cursor?: string
) {
  return vehicleService.listModelsByMake(makeId, { cursor, limit: 25 });
}

export async function getModelBySlugAction(
  makeSlug: string,
  modelSlug: string
) {
  return vehicleService.getModelBySlug(makeSlug, modelSlug);
}

export async function createModelAction(
  input: Omit<CreateVehicleModelInput, "slug">
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const model = await vehicleService.createModel({ ...input, slug });
    await writeAuditLog("VehicleModel", model.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/vehicles");
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

export async function updateModelAction(
  id: string,
  input: UpdateVehicleModelInput
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const model = await vehicleService.updateModel(id, input);
    await writeAuditLog("VehicleModel", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/vehicles");
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

export async function deleteModelAction(id: string): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await vehicleService.deleteModel(id);
    await writeAuditLog("VehicleModel", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/vehicles");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete model";
    return { success: false, error: msg };
  }
}

// ── Variants ───────────────────────────────────────

export async function listVariantsByModelAction(
  modelId: string,
  cursor?: string
) {
  return vehicleService.listVariantsByModel(modelId, { cursor, limit: 25 });
}

export async function getVariantByIdAction(id: string) {
  return vehicleService.getVariantById(id);
}

export async function createVariantAction(
  input: Omit<CreateVehicleVariantInput, "slug">
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const slug = slugify(input.name);
    const variant = await vehicleService.createVariant({ ...input, slug });
    await writeAuditLog("VehicleVariant", variant.id, "CREATE", user.id, {
      ...input,
      slug,
    });
    revalidatePath("/admin/catalogue/vehicles");
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

export async function updateVariantAction(
  id: string,
  input: UpdateVehicleVariantInput
): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    if (input.name && !input.slug) {
      input.slug = slugify(input.name);
    }
    const variant = await vehicleService.updateVariant(id, input);
    await writeAuditLog("VehicleVariant", id, "UPDATE", user.id, input);
    revalidatePath("/admin/catalogue/vehicles");
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

export async function deleteVariantAction(id: string): Promise<ActionResult> {
  const user = getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await vehicleService.deleteVariant(id);
    await writeAuditLog("VehicleVariant", id, "DELETE", user.id, {});
    revalidatePath("/admin/catalogue/vehicles");
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete variant";
    return { success: false, error: msg };
  }
}
