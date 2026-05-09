import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, serverError } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "15", 10), 50);
    const vehicleVariantId = searchParams.get("vehicleVariantId");

    if (!q) return NextResponse.json({ items: [] });

    const accessories = await prisma.accessory.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
        ],
        ...(vehicleVariantId
          ? { fitments: { some: { vehicleVariantId } } }
          : {}),
      },
      include: {
        brand: { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
        fitments: {
          where: vehicleVariantId ? { vehicleVariantId } : {},
          select: {
            id: true,
            installedWeightKg: true,
            mountingLocation: true,
          },
          take: 5,
        },
      },
      take: limit,
    });

    const items = accessories.flatMap((acc) =>
      acc.fitments.map((f) => ({
        fitmentId: f.id,
        accessoryId: acc.id,
        name: acc.name,
        brandId: acc.brand.id,
        brandName: acc.brand.name,
        brandLogoUrl: acc.brand.logoUrl,
        categoryId: acc.category.id,
        categoryName: acc.category.name,
        mountingLocation: f.mountingLocation,
        installedWeightKg: Number(f.installedWeightKg),
      })),
    );

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
