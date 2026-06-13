import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { prisma } from '@/lib/db';
import {
  parseSearchParams,
  withRateLimit,
  notFound,
  serverError,
} from '@/lib/api-helpers';

const filterSchema = z.object({
  bodyType: z
    .enum([
      'CARAVAN_POP_TOP',
      'CARAVAN_FULL_HEIGHT',
      'OFF_ROAD_CARAVAN',
      'CAMPER_TRAILER',
      'HYBRID',
      'FIFTH_WHEELER',
      'OTHER',
    ])
    .optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId } = await params;
  const parsed = parseSearchParams(request, filterSchema);
  if ('error' in parsed) return parsed.error;

  try {
    const make = await prisma.caravanMake.findUnique({ where: { id: makeId } });
    if (!make) return notFound('Caravan make');

    const allModels = await prisma.caravanModel.findMany({
      where: { makeId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { variants: true } } },
    });

    const bodyTypeFacets = [
      ...new Set(allModels.map((m) => m.bodyType)),
    ].sort();

    const items = parsed.data.bodyType
      ? allModels.filter((m) => m.bodyType === parsed.data.bodyType)
      : allModels;

    return NextResponse.json({
      items: items.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        bodyType: m.bodyType,
        variantCount: m._count.variants,
      })),
      facets: {
        bodyTypes: bodyTypeFacets,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
