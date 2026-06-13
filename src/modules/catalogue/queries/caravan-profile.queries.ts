import { prisma } from '@/lib/db';
import type { CaravanBodyType, AxleConfiguration } from '@prisma/client';
import type {
  CaravanVariantDto,
  CaravanMakeDto,
  CaravanModelDto,
} from '../types/caravan.types';

export interface CaravanAdjacentRangeLink {
  slug: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  makeSlug: string;
  modelSlug: string;
}

export interface CaravanSiblingVariantLink {
  slug: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  makeSlug: string;
  modelSlug: string;
}

export interface CaravanVariantProfileData {
  variant: CaravanVariantDto & {
    model: CaravanModelDto & { make: CaravanMakeDto };
  };
  olderRange: CaravanAdjacentRangeLink | null;
  newerRange: CaravanAdjacentRangeLink | null;
  siblings: CaravanSiblingVariantLink[];
}

export async function getCaravanVariantProfileData(
  makeSlug: string,
  modelSlug: string,
  variantSlug: string,
): Promise<CaravanVariantProfileData | null> {
  const make = await prisma.caravanMake.findUnique({
    where: { slug: makeSlug },
  });
  if (!make) return null;

  const model = await prisma.caravanModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
  });
  if (!model) return null;

  const variant = await prisma.caravanVariant.findUnique({
    where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
    include: { model: { include: { make: true } } },
  });
  if (!variant) return null;

  const [olderRaw, newerRaw, siblingsRaw] = await Promise.all([
    // Older: same name, yearTo < this.yearFrom, take max yearTo
    prisma.caravanVariant.findFirst({
      where: {
        modelId: model.id,
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
    prisma.caravanVariant.findFirst({
      where: {
        modelId: model.id,
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
    prisma.caravanVariant.findMany({
      where: {
        modelId: model.id,
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
  ): CaravanAdjacentRangeLink | null => {
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

export async function getAllCaravanVariantSlugsForSSG(): Promise<
  Array<{ make: string; model: string; variant: string }>
> {
  const variants = await prisma.caravanVariant.findMany({
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

export interface CaravanModelVariantRow {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  atmKg: number | null;
  gtmKg: number | null;
  tbmKg: number | null;
  axleConfiguration: AxleConfiguration;
}

export interface CaravanModelPageData {
  make: { id: string; name: string; slug: string };
  model: { id: string; name: string; slug: string; bodyType: CaravanBodyType };
  variants: CaravanModelVariantRow[];
}

export async function getCaravanModelPageData(
  makeSlug: string,
  modelSlug: string,
): Promise<CaravanModelPageData | null> {
  const make = await prisma.caravanMake.findUnique({
    where: { slug: makeSlug },
  });
  if (!make) return null;

  const model = await prisma.caravanModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
  });
  if (!model) return null;

  const variants = await prisma.caravanVariant.findMany({
    where: { modelId: model.id, status: 'CATALOGUE' },
    orderBy: { yearFrom: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      yearFrom: true,
      yearTo: true,
      isCurrentProduction: true,
      atmKg: true,
      gtmKg: true,
      tbmKg: true,
      axleConfiguration: true,
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

export async function getAllCaravanModelSlugsForSSG(): Promise<
  Array<{ make: string; model: string }>
> {
  const models = await prisma.caravanModel.findMany({
    where: { variants: { some: { status: 'CATALOGUE' } } },
    select: {
      slug: true,
      make: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return models.map((m) => ({ make: m.make.slug, model: m.slug }));
}
