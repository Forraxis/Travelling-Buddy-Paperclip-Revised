import { createHash } from "crypto";
import { prisma } from "@/lib/db";

function normalise(val: unknown): string {
  return String(val ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function vehicleFingerprint(data: {
  makeId: string;
  modelId: string;
  year: number;
  bodyType: string;
  drivetrain: string;
  transmission: string;
}): string {
  const key = [
    data.makeId,
    data.modelId,
    data.year,
    normalise(data.bodyType),
    normalise(data.drivetrain),
    normalise(data.transmission),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function caravanFingerprint(data: {
  makeId: string;
  modelId: string;
  year: number;
  bodyType: string;
  axleConfiguration: string;
}): string {
  const key = [
    data.makeId,
    data.modelId,
    data.year,
    normalise(data.bodyType),
    normalise(data.axleConfiguration),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function accessoryFingerprint(data: {
  brandName: string;
  modelName: string;
}): string {
  const key = [
    normalise(data.brandName),
    normalise(data.modelName),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  existingId: string | null;
  existingName: string | null;
}

export async function checkVehicleDuplicate(
  fingerprint: string
): Promise<DuplicateCheckResult> {
  // Check against existing approved variants first
  const variant = await prisma.vehicleVariant.findFirst({
    where: { slug: { contains: fingerprint } },
    select: { id: true, name: true },
  });
  if (variant) {
    return { hasDuplicate: true, existingId: variant.id, existingName: variant.name };
  }

  // Then check pending submissions with the same fingerprint
  const pending = await prisma.vehicleSubmission.findFirst({
    where: { duplicateFingerprint: fingerprint, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true },
  });
  if (pending) {
    return { hasDuplicate: true, existingId: pending.id, existingName: "existing submission" };
  }

  return { hasDuplicate: false, existingId: null, existingName: null };
}

export async function checkCaravanDuplicate(
  fingerprint: string
): Promise<DuplicateCheckResult> {
  const pending = await prisma.caravanSubmission.findFirst({
    where: { duplicateFingerprint: fingerprint, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true },
  });
  if (pending) {
    return { hasDuplicate: true, existingId: pending.id, existingName: "existing submission" };
  }
  return { hasDuplicate: false, existingId: null, existingName: null };
}

export async function checkAccessoryDuplicate(
  fingerprint: string
): Promise<DuplicateCheckResult> {
  const existing = await prisma.accessorySubmission.findFirst({
    where: { duplicateFingerprint: fingerprint, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true },
  });
  if (existing) {
    return { hasDuplicate: true, existingId: existing.id, existingName: "existing submission" };
  }
  return { hasDuplicate: false, existingId: null, existingName: null };
}
