import { prisma } from '@/lib/db';
import type { VehicleBodyType } from '@prisma/client';
import type {
  VehicleVariantDto,
  VehicleMakeDto,
  VehicleModelDto,
} from '../types/vehicle.types';

export interface AdjacentRangeLink {
  slug: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  makeSlug: string;
  modelSlug: string;
}

export interface SiblingVariantLink {
  slug: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  makeSlug: string;
  modelSlug: string;
}

export interface VariantProfileData {
  variant: VehicleVariantDto & {
    model: VehicleModelDto & { make: VehicleMakeDto };
  };
  olderRange: AdjacentRangeLink | null;
  newerRange: AdjacentRangeLink | null;
  siblings: SiblingVariantLink[];
}

export async function getVariantProfileData(
  makeSlug: string,
  modelSlug: string,
  variantSlug: string,
): Promise<VariantProfileData | null> {
  const make = await prisma.vehicleMake.findUnique({
    where: { slug: makeSlug },
  });
  if (!make) return null;

  const model = await prisma.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
  });
  if (!model) return null;

  const variant = await prisma.vehicleVariant.findUnique({
    where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
    include: { model: { include: { make: true } } },
  });
  // Public profile page: COMMUNITY variants (user submissions + admin spec
  // candidates) are not published — never render one even via a known slug.
  if (!variant || variant.status !== 'CATALOGUE') return null;

  const [olderRaw, newerRaw, siblingsRaw] = await Promise.all([
    // Older: same name, yearTo < this.yearFrom, take max yearTo
    prisma.vehicleVariant.findFirst({
      where: {
        modelId: model.id,
        status: 'CATALOGUE',
        name: variant.name,
        yearTo: { lt: variant.yearFrom },
      },
      orderBy: { yearTo: 'desc' },
      select: {
        slug: true,
        name: true,
        yearFrom: true,
        yearTo: true,
        isCurrentProduction: true,
      },
    }),
    // Newer: same name, yearFrom > this.yearTo, take min yearFrom
    prisma.vehicleVariant.findFirst({
      where: {
        modelId: model.id,
        status: 'CATALOGUE',
        name: variant.name,
        yearFrom: { gt: variant.yearTo },
      },
      orderBy: { yearFrom: 'asc' },
      select: {
        slug: true,
        name: true,
        yearFrom: true,
        yearTo: true,
        isCurrentProduction: true,
      },
    }),
    // Siblings: different name, year range overlaps >= 1 year
    prisma.vehicleVariant.findMany({
      where: {
        modelId: model.id,
        status: 'CATALOGUE',
        NOT: { name: variant.name },
        yearFrom: { lte: variant.yearTo },
        OR: [
          { yearTo: { gte: variant.yearFrom } },
          { isCurrentProduction: true },
        ],
      },
      orderBy: { yearFrom: 'desc' },
      take: 8,
      select: {
        slug: true,
        name: true,
        yearFrom: true,
        yearTo: true,
        isCurrentProduction: true,
      },
    }),
  ]);

  const toLink = (
    v: {
      slug: string;
      name: string;
      yearFrom: number;
      yearTo: number;
      isCurrentProduction: boolean;
    } | null,
  ): AdjacentRangeLink | null => {
    if (!v) return null;
    return { ...v, makeSlug: make.slug, modelSlug: model.slug };
  };

  return {
    variant,
    olderRange: toLink(olderRaw),
    newerRange: toLink(newerRaw),
    siblings: siblingsRaw.map((s) => ({
      ...s,
      makeSlug: make.slug,
      modelSlug: model.slug,
    })),
  };
}

export async function getAllVehicleVariantSlugsForSSG(): Promise<
  Array<{ make: string; model: string; variant: string }>
> {
  const variants = await prisma.vehicleVariant.findMany({
    where: { status: 'CATALOGUE' },
    select: {
      slug: true,
      model: { select: { slug: true, make: { select: { slug: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return variants.map((v) => ({
    make: v.model.make.slug,
    model: v.model.slug,
    variant: v.slug,
  }));
}

// ── Model-level page ────────────────────────────────────────────────────────

export interface VehicleModelVariantRow {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  gvmKg: number | null;
  gcmKg: number | null;
  maxTowingCapacityKg: number | null;
}

export interface VehicleModelPageData {
  make: { id: string; name: string; slug: string };
  model: { id: string; name: string; slug: string; bodyType: VehicleBodyType };
  variants: VehicleModelVariantRow[];
}

export async function getVehicleModelPageData(
  makeSlug: string,
  modelSlug: string,
): Promise<VehicleModelPageData | null> {
  const make = await prisma.vehicleMake.findUnique({
    where: { slug: makeSlug },
  });
  if (!make) return null;

  const model = await prisma.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
  });
  if (!model) return null;

  const variants = await prisma.vehicleVariant.findMany({
    where: { modelId: model.id, status: 'CATALOGUE' },
    orderBy: { yearFrom: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      yearFrom: true,
      yearTo: true,
      isCurrentProduction: true,
      gvmKg: true,
      gcmKg: true,
      maxTowingCapacityKg: true,
    },
  });

  return {
    make: { id: make.id, name: make.name, slug: make.slug },
    model: {
      id: model.id,
      name: model.name,
      slug: model.slug,
      bodyType: model.bodyType,
    },
    variants,
  };
}

export async function getAllVehicleModelSlugsForSSG(): Promise<
  Array<{ make: string; model: string }>
> {
  const models = await prisma.vehicleModel.findMany({
    where: { variants: { some: { status: 'CATALOGUE' } } },
    select: {
      slug: true,
      make: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return models.map((m) => ({ make: m.make.slug, model: m.slug }));
}
