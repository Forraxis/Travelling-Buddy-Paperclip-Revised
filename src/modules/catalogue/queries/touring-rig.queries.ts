import { prisma } from '@/lib/db';
import type { VehicleBodyType } from '@prisma/client';
import { parseComboSlug } from './combo.queries';

export const TOURING_BODY_TYPES: VehicleBodyType[] = [
  'DUAL_CAB_UTE',
  'EXTRA_CAB_UTE',
  'SINGLE_CAB_UTE',
  'WAGON',
  'SUV',
  'VAN',
  'TROOPCARRIER',
];

// Body types that are NOT suitable for touring rig pages
// (exclude SEDAN/HATCH — none in schema, but future-proof the filter)
const EXCLUDED_BODY_TYPES: VehicleBodyType[] = [];
void EXCLUDED_BODY_TYPES; // kept for documentation

export interface TouringAccessoryRow {
  id: string;
  name: string;
  slug: string;
  brandSlug: string;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  installedWeightKg: number;
  mountingLocation: string;
}

export interface TouringRigVariant {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  gvmKg: number | null;
  kerbWeightKg: number | null;
  gcmKg: number | null;
  maxTowingCapacityKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  model: {
    id: string;
    name: string;
    slug: string;
    bodyType: VehicleBodyType;
    make: { id: string; name: string; slug: string };
  };
}

export interface TouringRigPageData {
  variant: TouringRigVariant;
  accessories: TouringAccessoryRow[];
  gvmUpgradeAccessories: TouringAccessoryRow[];
}

const GVM_KEYWORDS = ['gvm', 'gross vehicle mass upgrade', 'upgrade kit'];

function isGvmUpgrade(accessoryName: string, categoryName: string): boolean {
  const n = accessoryName.toLowerCase();
  const c = categoryName.toLowerCase();
  return GVM_KEYWORDS.some((k) => n.includes(k) || c.includes(k));
}

export async function getTouringRigPageData(
  vehicleCompound: string,
): Promise<TouringRigPageData | null> {
  const parsed = parseComboSlug(vehicleCompound);
  if (!parsed) return null;

  const make = await prisma.vehicleMake.findUnique({
    where: { slug: parsed.makeSlug },
  });
  if (!make) return null;

  const model = await prisma.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: parsed.modelSlug } },
  });
  if (!model) return null;

  if (!TOURING_BODY_TYPES.includes(model.bodyType)) return null;

  const variant = await prisma.vehicleVariant.findUnique({
    where: { modelId_slug: { modelId: model.id, slug: parsed.variantSlug } },
    select: {
      id: true,
      name: true,
      slug: true,
      yearFrom: true,
      yearTo: true,
      isCurrentProduction: true,
      status: true,
      gvmKg: true,
      kerbWeightKg: true,
      gcmKg: true,
      maxTowingCapacityKg: true,
      frontAxleLimitKg: true,
      rearAxleLimitKg: true,
    },
  });
  if (!variant || variant.status !== 'CATALOGUE') return null;

  const fitmentsRaw = await prisma.accessoryFitment.findMany({
    where: { vehicleVariantId: variant.id },
    take: 60,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      installedWeightKg: true,
      mountingLocation: true,
      accessory: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          brand: { select: { name: true, slug: true } },
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const activeFitments = fitmentsRaw.filter(
    (f) => f.accessory.status === 'ACTIVE',
  );

  const toRow = (f: (typeof activeFitments)[0]): TouringAccessoryRow => ({
    id: f.accessory.id,
    name: f.accessory.name,
    slug: f.accessory.slug,
    brandSlug: f.accessory.brand.slug,
    brandName: f.accessory.brand.name,
    categoryName: f.accessory.category.name,
    categorySlug: f.accessory.category.slug,
    installedWeightKg: (
      f.installedWeightKg as unknown as { toNumber(): number }
    ).toNumber(),
    mountingLocation: f.mountingLocation,
  });

  const gvmUpgradeAccessories = activeFitments
    .filter((f) => isGvmUpgrade(f.accessory.name, f.accessory.category.name))
    .map(toRow);

  const accessories = activeFitments
    .filter((f) => !isGvmUpgrade(f.accessory.name, f.accessory.category.name))
    .slice(0, 12)
    .map(toRow);

  return {
    variant: {
      id: variant.id,
      name: variant.name,
      slug: variant.slug,
      yearFrom: variant.yearFrom,
      yearTo: variant.yearTo,
      isCurrentProduction: variant.isCurrentProduction,
      gvmKg: variant.gvmKg,
      kerbWeightKg: variant.kerbWeightKg,
      gcmKg: variant.gcmKg,
      maxTowingCapacityKg: variant.maxTowingCapacityKg,
      frontAxleLimitKg: variant.frontAxleLimitKg,
      rearAxleLimitKg: variant.rearAxleLimitKg,
      model: {
        id: model.id,
        name: model.name,
        slug: model.slug,
        bodyType: model.bodyType,
        make: { id: make.id, name: make.name, slug: make.slug },
      },
    },
    accessories,
    gvmUpgradeAccessories,
  };
}

export async function getAllTouringRigSlugsForSSG(): Promise<
  Array<{ vehicle: string }>
> {
  const variants = await prisma.vehicleVariant.findMany({
    where: {
      status: 'CATALOGUE',
      model: { bodyType: { in: TOURING_BODY_TYPES } },
    },
    select: {
      slug: true,
      model: { select: { slug: true, make: { select: { slug: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return variants.map((v) => ({
    vehicle: `${v.model.make.slug}_${v.model.slug}_${v.slug}`,
  }));
}
