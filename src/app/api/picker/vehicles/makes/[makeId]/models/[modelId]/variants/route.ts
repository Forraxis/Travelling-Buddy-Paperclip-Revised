import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  parseSearchParams,
  withRateLimit,
  notFound,
  serverError,
} from '@/lib/api-helpers';

const filterSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  fuelType: z.enum(['DIESEL', 'PETROL', 'HYBRID', 'ELECTRIC']).optional(),
  // Catalogue-granularity facets (CATALOGUE_GRANULARITY_PLAN.md milestone 4).
  generation: z.string().min(1).max(60).optional(),
  cabType: z.enum(['SINGLE_CAB', 'KING_CAB', 'DUAL_CAB', 'WAGON']).optional(),
  driveType: z
    .enum(['TWO_WHEEL_DRIVE', 'FOUR_WHEEL_DRIVE', 'ALL_WHEEL_DRIVE'])
    .optional(),
  badge: z.string().min(1).max(60).optional(),
  buildOrigin: z.string().min(2).max(2).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string; modelId: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId, modelId } = await params;
  const parsed = parseSearchParams(request, filterSchema);
  if ('error' in parsed) return parsed.error;

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    const model = await prisma.vehicleModel.findFirst({
      where: { id: modelId, makeId },
      include: { make: true },
    });
    if (!model) return notFound('Vehicle model');

    // Community filter clause — reused for both facets and filtered query
    const communityFilter = {
      OR: [
        { status: 'CATALOGUE' as const },
        {
          status: 'COMMUNITY' as const,
          communitySubmitterId: userId ?? '__no_match__',
        },
      ],
    };

    // Fetch all variants for facet computation
    const allVariants = await prisma.vehicleVariant.findMany({
      where: { modelId, ...communityFilter },
      select: {
        yearFrom: true,
        yearTo: true,
        fuelType: true,
        isCurrentProduction: true,
        generation: true,
        cabType: true,
        driveType: true,
        badge: true,
        buildOrigin: true,
      },
    });

    const currentYear = new Date().getFullYear();
    const fuelTypeFacets = [
      ...new Set(allVariants.map((v) => v.fuelType)),
    ].sort();
    // Facet option lists for the granularity facets — only the values actually
    // present on this model's variants (so the UI collapses any single-option facet).
    const distinct = <T>(xs: (T | null | undefined)[]): T[] =>
      [...new Set(xs.filter((x): x is T => x != null))].sort();
    const generationFacets = distinct(allVariants.map((v) => v.generation));
    const cabTypeFacets = distinct(allVariants.map((v) => v.cabType));
    const driveTypeFacets = distinct(allVariants.map((v) => v.driveType));
    const badgeFacets = distinct(allVariants.map((v) => v.badge));
    const buildOriginFacets = distinct(allVariants.map((v) => v.buildOrigin));
    const yearMin = allVariants.length
      ? Math.min(...allVariants.map((v) => v.yearFrom))
      : null;
    const yearMax = allVariants.length
      ? Math.max(
          ...allVariants.map((v) =>
            v.isCurrentProduction ? currentYear : v.yearTo,
          ),
        )
      : null;

    // Apply filters
    const {
      year,
      fuelType,
      generation,
      cabType,
      driveType,
      badge,
      buildOrigin,
    } = parsed.data;
    const andClauses: object[] = [{ modelId }, communityFilter];
    if (fuelType) andClauses.push({ fuelType });
    if (generation) andClauses.push({ generation });
    if (cabType) andClauses.push({ cabType });
    if (driveType) andClauses.push({ driveType });
    if (badge) andClauses.push({ badge });
    if (buildOrigin) andClauses.push({ buildOrigin });
    if (year) {
      andClauses.push({ yearFrom: { lte: year } });
      andClauses.push({
        OR: [{ yearTo: { gte: year } }, { isCurrentProduction: true }],
      });
    }

    const variants = await prisma.vehicleVariant.findMany({
      where: { AND: andClauses },
      include: { model: { include: { make: true } } },
      orderBy: [{ yearFrom: 'desc' }, { name: 'asc' }],
    });

    const items = variants.map((v) => {
      const yearSpan = v.isCurrentProduction
        ? `${v.yearFrom}–present`
        : `${v.yearFrom}–${v.yearTo}`;
      return {
        id: v.id,
        type: 'vehicle' as const,
        label: `${v.model.make.name} ${v.model.name} ${v.name} (${yearSpan})`,
        make: v.model.make.name,
        makeId: v.model.make.id,
        makeSlug: v.model.make.slug,
        model: v.model.name,
        modelId: v.model.id,
        modelSlug: v.model.slug,
        variant: v.name,
        variantSlug: v.slug,
        yearSpan,
        specs: {
          gvmKg: v.gvmKg,
          gcmKg: v.gcmKg,
          maxTowingCapacityKg: v.maxTowingCapacityKg,
          kerbWeightKg: v.kerbWeightKg,
          fuelType: v.fuelType,
          bodyType: v.model.bodyType,
          generation: v.generation,
          cabType: v.cabType,
          driveType: v.driveType,
          badge: v.badge,
          transmission: v.transmission,
          buildOrigin: v.buildOrigin,
        },
        confidenceBadge: (v.status === 'COMMUNITY'
          ? 'community'
          : 'manufacturer_spec') as 'community' | 'manufacturer_spec',
      };
    });

    return NextResponse.json({
      items,
      facets: {
        yearMin,
        yearMax,
        fuelTypes: fuelTypeFacets,
        bodyType: model.bodyType,
        generations: generationFacets,
        cabTypes: cabTypeFacets,
        driveTypes: driveTypeFacets,
        badges: badgeFacets,
        buildOrigins: buildOriginFacets,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
