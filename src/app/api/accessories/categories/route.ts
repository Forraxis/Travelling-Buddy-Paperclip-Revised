import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const vehicleVariantId = searchParams.get('vehicleVariantId') ?? undefined;
    const caravanVariantId = searchParams.get('caravanVariantId') ?? undefined;

    // For caravans, show all accessories that fit any caravan (variant-specific
    // weight/location is resolved at the items step, not during browse).
    const fitmentFilter = vehicleVariantId
      ? { vehicleVariantId }
      : caravanVariantId
        ? { caravanVariantId: { not: null } }
        : undefined;

    const accessoryWhere = {
      status: 'ACTIVE' as const,
      ...(fitmentFilter ? { fitments: { some: fitmentFilter } } : {}),
    };

    const categories = await prisma.accessoryCategory.findMany({
      where: { accessories: { some: accessoryWhere } },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { accessories: { where: accessoryWhere } } },
      },
    });

    const items = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconName: null,
      accessoryCount: c._count.accessories,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
