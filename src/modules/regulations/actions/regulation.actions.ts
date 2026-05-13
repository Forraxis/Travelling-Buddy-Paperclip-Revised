"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createRegulationService } from "../services/regulation.service";
import { getAdminUser } from "@/modules/admin/lib/auth";
import type { RegulationData } from "../types/regulation.types";

const regulationService = createRegulationService(prisma);

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

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

export async function listRegulationSetsAction() {
  const user = await getAdminUser();
  if (!user) return [];
  return regulationService.listSets();
}

export async function getRegulationSetAction(code: string) {
  const user = await getAdminUser();
  if (!user) return null;
  return regulationService.getSetByCode(code);
}

export async function listRegulationVersionsAction(code: string) {
  const user = await getAdminUser();
  if (!user) return [];
  return regulationService.listVersions(code);
}

export async function getRegulationVersionAction(id: string) {
  const user = await getAdminUser();
  if (!user) return null;
  return regulationService.getVersion(id);
}

export async function saveRegulationVersionAction(
  code: string,
  data: RegulationData,
  effectiveDateStr: string,
  changeSummary: string
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (user.role !== "ADMIN") return { success: false, error: "ADMIN role required" };
  if (!changeSummary.trim()) return { success: false, error: "Change summary is required" };

  try {
    const effectiveDate = new Date(effectiveDateStr);
    if (isNaN(effectiveDate.getTime())) {
      return { success: false, error: "Invalid effective date" };
    }

    const version = await regulationService.saveVersion(
      code,
      data,
      effectiveDate,
      changeSummary.trim(),
      user.id
    );

    await writeAuditLog("RegulationSetVersion", version.id, "CREATE", user.id, {
      code,
      effectiveDate: effectiveDateStr,
      changeSummary: changeSummary.trim(),
      versionNumber: version.versionNumber,
    });

    revalidatePath(`/admin/regulations/${code}`);
    revalidatePath(`/admin/regulations/${code}/versions`);
    revalidatePath("/admin/regulations");

    return { success: true, data: version };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
