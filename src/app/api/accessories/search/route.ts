import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '15', 10), 50);
    const vehicleVariantId = searchParams.get('vehicleVariantId');
    const caravanVariantId = searchParams.get('caravanVariantId');

    if (!q) return NextResponse.json({ items: [] });

    const fitmentVariantFilter = vehicleVariantId
      ? { vehicleVariantId }
      : caravanVariantId
        ? { caravanVariantId }
        : null;

    const accessories = await prisma.accessory.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
        ],
        ...(fitmentVariantFilter
          ? { fitments: { some: fitmentVariantFilter } }
          : {}),
      },
      include: {
        brand: { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
        fitments: {
          where: fitmentVariantFilter ?? {},
          select: {
            id: true,
            installedWeightKg: true,
            mountingLocation: true,
            cogXMm: true,
            cogYMm: true,
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
        cogXMm: f.cogXMm,
        cogYMm: f.cogYMm,
        placementScope: acc.placementScope,
      })),
    );

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
