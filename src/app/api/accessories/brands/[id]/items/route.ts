import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { id: brandId } = await params;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const mountingLocation = searchParams.get('mountingLocation') ?? undefined;
    const vehicleVariantId = searchParams.get('vehicleVariantId') ?? undefined;
    const caravanVariantId = searchParams.get('caravanVariantId') ?? undefined;

    const variantFilter = vehicleVariantId
      ? { vehicleVariantId }
      : caravanVariantId
        ? { caravanVariantId }
        : {};

    const fitments = await prisma.accessoryFitment.findMany({
      where: {
        ...variantFilter,
        ...(mountingLocation
          ? { mountingLocation: mountingLocation as never }
          : {}),
        accessory: {
          brandId,
          status: 'ACTIVE',
          ...(categoryId ? { categoryId } : {}),
        },
      },
      include: {
        accessory: {
          include: {
            brand: { select: { id: true, name: true, logoUrl: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ accessory: { name: 'asc' } }, { mountingLocation: 'asc' }],
    });

    const items = fitments.map((f) => ({
      fitmentId: f.id,
      accessoryId: f.accessory.id,
      name: f.accessory.name,
      brandId: f.accessory.brand.id,
      brandName: f.accessory.brand.name,
      brandLogoUrl: f.accessory.brand.logoUrl,
      categoryId: f.accessory.category.id,
      categoryName: f.accessory.category.name,
      mountingLocation: f.mountingLocation,
      installedWeightKg: Number(f.installedWeightKg),
      cogXMm: f.cogXMm,
      cogYMm: f.cogYMm,
      placementScope: f.accessory.placementScope,
    }));

    const allLocations = [
      ...new Set(fitments.map((f) => f.mountingLocation as string)),
    ].sort();

    return NextResponse.json({ items, allLocations });
  } catch (err) {
    return serverError(err);
  }
}
