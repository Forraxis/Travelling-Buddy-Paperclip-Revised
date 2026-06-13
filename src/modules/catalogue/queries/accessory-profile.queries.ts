import { prisma } from '@/lib/db';
import type { MountingLocation, FitmentConfidence } from '@prisma/client';

export interface AccessoryFitmentRow {
  id: string;
  installedWeightKg: number;
  mountingLocation: MountingLocation;
  confidence: FitmentConfidence;
  vehicleVariant: {
    id: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    model: { name: string; slug: string; make: { name: string; slug: string } };
  } | null;
  caravanVariant: {
    id: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    model: { name: string; slug: string; make: { name: string; slug: string } };
  } | null;
}

export interface RelatedAccessoryRow {
  id: string;
  name: string;
  slug: string;
  brand: { name: string; slug: string };
  priceMin: number | null;
  priceMax: number | null;
  currencyCode: string;
}

export interface AccessoryProfileData {
  accessory: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrls: string[];
    priceMin: number | null;
    priceMax: number | null;
    currencyCode: string;
    affiliateUrl: string | null;
  };
  brand: { id: string; name: string; slug: string; logoUrl: string | null };
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  fitments: AccessoryFitmentRow[];
  relatedAccessories: RelatedAccessoryRow[];
}

export async function getAccessoryProfileData(
  brandSlug: string,
  accessorySlug: string,
): Promise<AccessoryProfileData | null> {
  const brand = await prisma.accessoryBrand.findUnique({
    where: { slug: brandSlug },
  });
  if (!brand) return null;

  const raw = await prisma.accessory.findUnique({
    where: { brandId_slug: { brandId: brand.id, slug: accessorySlug } },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrls: true,
      priceMin: true,
      priceMax: true,
      currencyCode: true,
      affiliateUrl: true,
      status: true,
      category: {
        select: { id: true, name: true, slug: true, description: true },
      },
      fitments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          installedWeightKg: true,
          mountingLocation: true,
          confidence: true,
          vehicleVariant: {
            select: {
              id: true,
              name: true,
              slug: true,
              yearFrom: true,
              yearTo: true,
              isCurrentProduction: true,
              model: {
                select: {
                  name: true,
                  slug: true,
                  make: { select: { name: true, slug: true } },
                },
              },
            },
          },
          caravanVariant: {
            select: {
              id: true,
              name: true,
              slug: true,
              yearFrom: true,
              yearTo: true,
              isCurrentProduction: true,
              model: {
                select: {
                  name: true,
                  slug: true,
                  make: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!raw || raw.status !== 'ACTIVE') return null;

  const relatedRaw = await prisma.accessory.findMany({
    where: {
      categoryId: raw.category.id,
      status: 'ACTIVE',
      NOT: { id: raw.id },
    },
    take: 6,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      priceMin: true,
      priceMax: true,
      currencyCode: true,
      brand: { select: { name: true, slug: true } },
    },
  });

  return {
    accessory: {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      imageUrls: raw.imageUrls,
      priceMin: raw.priceMin ? raw.priceMin.toNumber() : null,
      priceMax: raw.priceMax ? raw.priceMax.toNumber() : null,
      currencyCode: raw.currencyCode,
      affiliateUrl: raw.affiliateUrl,
    },
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
    },
    category: raw.category,
    fitments: raw.fitments.map((f) => ({
      id: f.id,
      installedWeightKg: (
        f.installedWeightKg as unknown as { toNumber(): number }
      ).toNumber(),
      mountingLocation: f.mountingLocation,
      confidence: f.confidence,
      vehicleVariant: f.vehicleVariant,
      caravanVariant: f.caravanVariant,
    })),
    relatedAccessories: relatedRaw.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      brand: r.brand,
      priceMin: r.priceMin
        ? (r.priceMin as unknown as { toNumber(): number }).toNumber()
        : null,
      priceMax: r.priceMax
        ? (r.priceMax as unknown as { toNumber(): number }).toNumber()
        : null,
      currencyCode: r.currencyCode,
    })),
  };
}

export async function getAllActiveAccessorySlugsForSSG(): Promise<
  Array<{ brand: string; accessory: string }>
> {
  const accessories = await prisma.accessory.findMany({
    where: { status: 'ACTIVE' },
    select: {
      slug: true,
      brand: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return accessories.map((a) => ({ brand: a.brand.slug, accessory: a.slug }));
}
