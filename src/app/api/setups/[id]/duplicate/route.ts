import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateShareToken } from "@/lib/share-token";
import { serverError, notFound } from "@/lib/api-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const source = await prisma.setup.findUnique({
      where: { id, deletedAt: null },
      include: {
        accessories: true,
        caravanAccessories: true,
        customLoads: true,
      },
    });

    if (!source) return notFound("Setup");
    if (source.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const copy = await prisma.setup.create({
      data: {
        userId: session.user.id,
        name: `${source.name} (copy)`,
        vehicleVariantId: source.vehicleVariantId,
        caravanVariantId: source.caravanVariantId,
        passengers: source.passengers,
        cargoKg: source.cargoKg,
        fuelPercent: source.fuelPercent,
        freshWaterPercent: source.freshWaterPercent,
        greyWaterPercent: source.greyWaterPercent,
        calibrationOverrides: source.calibrationOverrides ?? {},
        regulationSetCode: source.regulationSetCode,
        tags: source.tags,
        shareToken: generateShareToken(),
        accessories: {
          create: source.accessories.map((a) => ({
            fitmentId: a.fitmentId,
            parentId: a.parentId,
            quantityOverride: a.quantityOverride,
            fillPercent: a.fillPercent,
            notes: a.notes,
          })),
        },
        caravanAccessories: {
          create: source.caravanAccessories.map((a) => ({
            fitmentId: a.fitmentId,
            parentId: a.parentId,
            quantityOverride: a.quantityOverride,
            fillPercent: a.fillPercent,
            notes: a.notes,
          })),
        },
        customLoads: {
          create: source.customLoads.map((l) => ({
            label: l.label,
            weightKg: l.weightKg,
            mountingLocation: l.mountingLocation,
            cogXMm: l.cogXMm,
            cogYMm: l.cogYMm,
            notes: l.notes,
          })),
        },
      },
      include: {
        vehicleVariant: { include: { model: { include: { make: true } } } },
        caravanVariant: { include: { model: { include: { make: true } } } },
      },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
