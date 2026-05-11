import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/account/export
 *
 * Generates a JSON export of the authenticated user's data.
 *
 * Rate limit: 1 request per user per 5 minutes (returns 429 on excess).
 *
 * Export schema:
 * {
 *   exportedAt: string (ISO 8601),
 *   user: {
 *     id: string,
 *     name: string | null,
 *     email: string,
 *     role: UserRole,
 *     trustTier: TrustTier,
 *     homeState: AustralianState | null,
 *     createdAt: string (ISO 8601),
 *     updatedAt: string (ISO 8601)
 *   },
 *   notificationPreferences: {
 *     submissionApproved: boolean,
 *     submissionRejected: boolean,
 *     trustTierPromoted: boolean,
 *     savedSetupCatalogueUpdate: boolean
 *   },
 *   setups: Array<{
 *     id: string,
 *     name: string,
 *     vehicle: { make: string, model: string, variant: string } | null,
 *     caravan: { make: string, model: string, variant: string } | null,
 *     passengers: number,
 *     cargoKg: number,
 *     fuelPercent: number,
 *     freshWaterPercent: number,
 *     greyWaterPercent: number,
 *     calibrationOverrides: object,
 *     regulationSetCode: string,
 *     tags: string[],
 *     accessories: Array<{
 *       fitmentId: string,
 *       accessoryName: string,
 *       brandName: string,
 *       quantityOverride: number,
 *       fillPercent: number,
 *       notes: string | null
 *     }>,
 *     caravanAccessories: Array<{ ...same as accessories }>,
 *     customLoads: Array<{
 *       label: string,
 *       weightKg: number,
 *       mountingLocation: string,
 *       notes: string | null
 *     }>,
 *     createdAt: string (ISO 8601),
 *     updatedAt: string (ISO 8601)
 *   }>
 * }
 */

const EXPORT_WINDOW_MS = 5 * 60 * 1000;
const exportTimestamps = new Map<string, number>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of exportTimestamps) {
      if (now - ts > EXPORT_WINDOW_MS) exportTimestamps.delete(key);
    }
  }, EXPORT_WINDOW_MS);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = Date.now();
  const lastExport = exportTimestamps.get(userId);

  if (lastExport && now - lastExport < EXPORT_WINDOW_MS) {
    const retryAfter = Math.ceil((EXPORT_WINDOW_MS - (now - lastExport)) / 1000);
    return NextResponse.json(
      { error: "Export rate limit exceeded. Please wait before requesting another export." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  exportTimestamps.set(userId, now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      trustTier: true,
      homeState: true,
      notificationPreferences: true,
      createdAt: true,
      updatedAt: true,
      setups: {
        where: { deletedAt: null },
        include: {
          vehicleVariant: {
            include: { model: { include: { make: true } } },
          },
          caravanVariant: {
            include: { model: { include: { make: true } } },
          },
          accessories: {
            include: {
              fitment: {
                include: {
                  accessory: { include: { brand: true } },
                },
              },
            },
          },
          caravanAccessories: {
            include: {
              fitment: {
                include: {
                  accessory: { include: { brand: true } },
                },
              },
            },
          },
          customLoads: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const defaultPrefs = {
    submissionApproved: true,
    submissionRejected: true,
    trustTierPromoted: true,
    savedSetupCatalogueUpdate: true,
  };

  const storedPrefs =
    typeof user.notificationPreferences === "object" &&
    user.notificationPreferences !== null
      ? user.notificationPreferences
      : {};

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      trustTier: user.trustTier,
      homeState: user.homeState,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    notificationPreferences: { ...defaultPrefs, ...storedPrefs },
    setups: user.setups.map((s) => ({
      id: s.id,
      name: s.name,
      vehicle: s.vehicleVariant
        ? {
            make: s.vehicleVariant.model.make.name,
            model: s.vehicleVariant.model.name,
            variant: s.vehicleVariant.name,
          }
        : null,
      caravan: s.caravanVariant
        ? {
            make: s.caravanVariant.model.make.name,
            model: s.caravanVariant.model.name,
            variant: s.caravanVariant.name,
          }
        : null,
      passengers: s.passengers,
      cargoKg: Number(s.cargoKg),
      fuelPercent: s.fuelPercent,
      freshWaterPercent: s.freshWaterPercent,
      greyWaterPercent: s.greyWaterPercent,
      calibrationOverrides: s.calibrationOverrides,
      regulationSetCode: s.regulationSetCode,
      tags: s.tags,
      accessories: s.accessories.map((a) => ({
        fitmentId: a.fitmentId,
        accessoryName: a.fitment.accessory.name,
        brandName: a.fitment.accessory.brand.name,
        quantityOverride: a.quantityOverride,
        fillPercent: a.fillPercent,
        notes: a.notes,
      })),
      caravanAccessories: s.caravanAccessories.map((a) => ({
        fitmentId: a.fitmentId,
        accessoryName: a.fitment.accessory.name,
        brandName: a.fitment.accessory.brand.name,
        quantityOverride: a.quantityOverride,
        fillPercent: a.fillPercent,
        notes: a.notes,
      })),
      customLoads: s.customLoads.map((l) => ({
        label: l.label,
        weightKg: Number(l.weightKg),
        mountingLocation: l.mountingLocation,
        notes: l.notes,
      })),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(exportData, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=travellingbuddy-export-${dateStr}.json`,
    },
  });
}
