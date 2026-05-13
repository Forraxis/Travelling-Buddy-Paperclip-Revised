"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/modules/admin/lib/auth";
import type { SponsorStatus, PlacementType, PlacementTier, VehicleBodyType } from "@prisma/client";

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

// ── Types ────────────────────────────────────────────────────────────

export interface SponsorDto {
  id: string;
  name: string;
  status: SponsorStatus;
  contactName: string | null;
  contactEmail: string | null;
  billingReference: string | null;
  placementCount: number;
  createdAt: string;
}

export interface PlacementDto {
  id: string;
  sponsorId: string;
  sponsorName: string;
  placementType: PlacementType;
  accessoryId: string | null;
  accessoryName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  vehicleBodyType: VehicleBodyType | null;
  tier: PlacementTier;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateSponsorInput {
  name: string;
  status?: SponsorStatus;
  contactName?: string;
  contactEmail?: string;
  billingReference?: string;
}

export interface UpdateSponsorInput {
  name?: string;
  status?: SponsorStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  billingReference?: string | null;
}

export interface CreatePlacementInput {
  sponsorId: string;
  placementType: PlacementType;
  tier: PlacementTier;
  startsAt: string;
  endsAt: string;
  accessoryId?: string | null;
  categoryId?: string | null;
  vehicleBodyType?: VehicleBodyType | null;
  notes?: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface AccessoryOption {
  id: string;
  name: string;
  slug: string;
}

// ── Sponsors ─────────────────────────────────────────────────────────

export async function listSponsorsAction(): Promise<SponsorDto[]> {
  const sponsors = await prisma.sponsor.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { placements: true } },
    },
  });

  return sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    billingReference: s.billingReference,
    placementCount: s._count.placements,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getSponsorByIdAction(id: string): Promise<SponsorDto | null> {
  const s = await prisma.sponsor.findUnique({
    where: { id },
    include: { _count: { select: { placements: true } } },
  });
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    billingReference: s.billingReference,
    placementCount: s._count.placements,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function createSponsorAction(input: CreateSponsorInput): Promise<ActionResult<SponsorDto>> {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Unauthorized" };
  try {
    const sponsor = await prisma.sponsor.create({
      data: {
        name: input.name,
        status: input.status ?? "ACTIVE",
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        billingReference: input.billingReference ?? null,
      },
      include: { _count: { select: { placements: true } } },
    });
    await writeAuditLog("Sponsor", sponsor.id, "CREATE", user.id, input);
    revalidatePath("/admin/sponsorship");
    return {
      success: true,
      data: {
        id: sponsor.id,
        name: sponsor.name,
        status: sponsor.status,
        contactName: sponsor.contactName,
        contactEmail: sponsor.contactEmail,
        billingReference: sponsor.billingReference,
        placementCount: sponsor._count.placements,
        createdAt: sponsor.createdAt.toISOString(),
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function updateSponsorAction(id: string, input: UpdateSponsorInput): Promise<ActionResult<SponsorDto>> {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Unauthorized" };
  try {
    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.billingReference !== undefined && { billingReference: input.billingReference }),
      },
      include: { _count: { select: { placements: true } } },
    });
    await writeAuditLog("Sponsor", id, "UPDATE", user.id, input);
    revalidatePath("/admin/sponsorship");
    revalidatePath(`/admin/sponsorship/${id}`);
    return {
      success: true,
      data: {
        id: sponsor.id,
        name: sponsor.name,
        status: sponsor.status,
        contactName: sponsor.contactName,
        contactEmail: sponsor.contactEmail,
        billingReference: sponsor.billingReference,
        placementCount: sponsor._count.placements,
        createdAt: sponsor.createdAt.toISOString(),
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ── Placements ───────────────────────────────────────────────────────

export async function listPlacementsForSponsorAction(sponsorId: string): Promise<PlacementDto[]> {
  const placements = await prisma.sponsoredPlacement.findMany({
    where: { sponsorId },
    include: {
      sponsor: true,
      accessory: true,
      category: true,
    },
    orderBy: { startsAt: "desc" },
  });

  return placements.map(mapPlacement);
}

export async function listAllPlacementsAction(fromDate?: Date, toDate?: Date): Promise<PlacementDto[]> {
  const now = fromDate ?? new Date();
  const end = toDate ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const placements = await prisma.sponsoredPlacement.findMany({
    where: {
      startsAt: { lte: end },
      endsAt: { gte: now },
    },
    include: {
      sponsor: true,
      accessory: true,
      category: true,
    },
    orderBy: [{ startsAt: "asc" }],
  });

  return placements.map(mapPlacement);
}

function mapPlacement(p: {
  id: string;
  sponsorId: string;
  placementType: PlacementType;
  accessoryId: string | null;
  categoryId: string | null;
  vehicleBodyType: VehicleBodyType | null;
  tier: PlacementTier;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  createdAt: Date;
  sponsor: { name: string };
  accessory: { name: string } | null;
  category: { name: string } | null;
}): PlacementDto {
  return {
    id: p.id,
    sponsorId: p.sponsorId,
    sponsorName: p.sponsor.name,
    placementType: p.placementType,
    accessoryId: p.accessoryId,
    accessoryName: p.accessory?.name ?? null,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    vehicleBodyType: p.vehicleBodyType,
    tier: p.tier,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function createPlacementAction(input: CreatePlacementInput): Promise<ActionResult<PlacementDto>> {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (endsAt <= startsAt) {
    return { success: false, error: "End date must be after start date" };
  }

  // Overlap validation: same tier + same scope + overlapping dates
  const overlapping = await prisma.sponsoredPlacement.findFirst({
    where: {
      tier: input.tier,
      placementType: input.placementType,
      accessoryId: input.accessoryId ?? null,
      categoryId: input.categoryId ?? null,
      vehicleBodyType: input.vehicleBodyType ?? null,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    include: { sponsor: true },
  });

  if (overlapping) {
    return {
      success: false,
      error: `Conflict: sponsor "${overlapping.sponsor.name}" already holds tier ${input.tier} for this scope from ${overlapping.startsAt.toLocaleDateString()} to ${overlapping.endsAt.toLocaleDateString()}`,
    };
  }

  try {
    const placement = await prisma.sponsoredPlacement.create({
      data: {
        sponsorId: input.sponsorId,
        placementType: input.placementType,
        tier: input.tier,
        startsAt,
        endsAt,
        accessoryId: input.accessoryId ?? null,
        categoryId: input.categoryId ?? null,
        vehicleBodyType: input.vehicleBodyType ?? null,
        notes: input.notes ?? null,
      },
      include: {
        sponsor: true,
        accessory: true,
        category: true,
      },
    });

    await writeAuditLog("SponsoredPlacement", placement.id, "CREATE", user.id, {
      sponsorId: input.sponsorId,
      placementType: input.placementType,
      tier: input.tier,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    revalidatePath("/admin/sponsorship");
    revalidatePath(`/admin/sponsorship/${input.sponsorId}`);
    revalidatePath("/admin/sponsorship/schedule");

    return { success: true, data: mapPlacement(placement) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function deletePlacementAction(id: string): Promise<ActionResult<void>> {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Unauthorized" };
  try {
    const placement = await prisma.sponsoredPlacement.findUnique({ where: { id } });
    if (!placement) return { success: false, error: "Placement not found" };

    await prisma.sponsoredPlacement.delete({ where: { id } });
    await writeAuditLog("SponsoredPlacement", id, "DELETE", user.id, { id });
    revalidatePath("/admin/sponsorship");
    revalidatePath(`/admin/sponsorship/${placement.sponsorId}`);
    revalidatePath("/admin/sponsorship/schedule");
    return { success: true, data: undefined };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ── Lookup helpers ────────────────────────────────────────────────────

export async function listCategoryOptionsAction(): Promise<CategoryOption[]> {
  const cats = await prisma.accessoryCategory.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  return cats;
}

export async function listAccessoryOptionsAction(search?: string): Promise<AccessoryOption[]> {
  const accessories = await prisma.accessory.findMany({
    where: search
      ? { name: { contains: search, mode: "insensitive" } }
      : undefined,
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return accessories;
}
