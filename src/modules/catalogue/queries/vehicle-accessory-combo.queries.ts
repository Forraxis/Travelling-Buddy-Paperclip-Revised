import { prisma } from "@/lib/db";
import { parseComboSlug } from "./combo.queries";

export interface VehicleAccessoryComboAccessoryRow {
  id: string;
  name: string;
  slug: string;
  brandSlug: string;
  brandName: string;
  installedWeightKg: number;
  affiliateUrl: string | null;
  gvmHeadroomAfterKg: number | null;
  priceMin: number | null;
  priceMax: number | null;
  currencyCode: string;
}

export interface VehicleAccessoryComboRelatedCategory {
  name: string;
  slug: string;
  accessoryCount: number;
}

export interface VehicleAccessoryComboPageData {
  vehicleCompound: string;
  vehicle: {
    id: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    gvmKg: number | null;
    kerbWeightKg: number | null;
    model: {
      name: string;
      slug: string;
      make: { name: string; slug: string };
    };
  };
  category: { id: string; name: string; slug: string; description: string | null };
  accessories: VehicleAccessoryComboAccessoryRow[];
  gvmHeadroomBeforeKg: number | null;
  combinedWeightKg: number;
  combinedGvmHeadroomAfterKg: number | null;
  relatedCategories: VehicleAccessoryComboRelatedCategory[];
}

export async function getVehicleAccessoryComboPageData(
  vehicleCompound: string,
  categorySlug: string,
): Promise<VehicleAccessoryComboPageData | null> {
  const parsed = parseComboSlug(vehicleCompound);
  if (!parsed) return null;

  const make = await prisma.vehicleMake.findUnique({ where: { slug: parsed.makeSlug } });
  if (!make) return null;

  const model = await prisma.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: parsed.modelSlug } },
  });
  if (!model) return null;

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
    },
  });
  if (!variant || variant.status !== "CATALOGUE") return null;

  const category = await prisma.accessoryCategory.findUnique({
    where: { slug: categorySlug },
    select: { id: true, name: true, slug: true, description: true },
  });
  if (!category) return null;

  const fitmentsRaw = await prisma.accessoryFitment.findMany({
    where: {
      vehicleVariantId: variant.id,
      accessory: { status: "ACTIVE", categoryId: category.id },
    },
    orderBy: { installedWeightKg: "asc" },
    select: {
      installedWeightKg: true,
      accessory: {
        select: {
          id: true,
          name: true,
          slug: true,
          affiliateUrl: true,
          priceMin: true,
          priceMax: true,
          currencyCode: true,
          brand: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (fitmentsRaw.length < 3) return null;

  const gvmKg = variant.gvmKg;
  const kerbWeightKg = variant.kerbWeightKg;
  const gvmHeadroomBeforeKg =
    gvmKg != null && kerbWeightKg != null ? gvmKg - kerbWeightKg : null;

  const accessories: VehicleAccessoryComboAccessoryRow[] = fitmentsRaw.map((f) => {
    const weightKg = (f.installedWeightKg as unknown as { toNumber(): number }).toNumber();
    return {
      id: f.accessory.id,
      name: f.accessory.name,
      slug: f.accessory.slug,
      brandSlug: f.accessory.brand.slug,
      brandName: f.accessory.brand.name,
      installedWeightKg: weightKg,
      affiliateUrl: f.accessory.affiliateUrl,
      gvmHeadroomAfterKg:
        gvmHeadroomBeforeKg != null ? gvmHeadroomBeforeKg - weightKg : null,
      priceMin: f.accessory.priceMin
        ? (f.accessory.priceMin as unknown as { toNumber(): number }).toNumber()
        : null,
      priceMax: f.accessory.priceMax
        ? (f.accessory.priceMax as unknown as { toNumber(): number }).toNumber()
        : null,
      currencyCode: f.accessory.currencyCode,
    };
  });

  const combinedWeightKg = accessories.reduce((s, a) => s + a.installedWeightKg, 0);
  const combinedGvmHeadroomAfterKg =
    gvmHeadroomBeforeKg != null ? gvmHeadroomBeforeKg - combinedWeightKg : null;

  // Related categories: other categories with >= 3 accessories fitted to this vehicle
  const allFitmentsForVehicle = await prisma.accessoryFitment.findMany({
    where: { vehicleVariantId: variant.id, accessory: { status: "ACTIVE" } },
    select: {
      accessory: { select: { category: { select: { id: true, name: true, slug: true } } } },
    },
  });

  const catCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const f of allFitmentsForVehicle) {
    const cat = f.accessory.category;
    if (cat.slug === categorySlug) continue;
    const entry = catCounts.get(cat.id);
    if (entry) {
      entry.count++;
    } else {
      catCounts.set(cat.id, { name: cat.name, slug: cat.slug, count: 1 });
    }
  }

  const relatedCategories = Array.from(catCounts.values())
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ name, slug, count }) => ({ name, slug, accessoryCount: count }));

  return {
    vehicleCompound,
    vehicle: {
      id: variant.id,
      name: variant.name,
      slug: variant.slug,
      yearFrom: variant.yearFrom,
      yearTo: variant.yearTo,
      isCurrentProduction: variant.isCurrentProduction,
      gvmKg,
      kerbWeightKg,
      model: {
        name: model.name,
        slug: model.slug,
        make: { name: make.name, slug: make.slug },
      },
    },
    category,
    accessories,
    gvmHeadroomBeforeKg,
    combinedWeightKg,
    combinedGvmHeadroomAfterKg,
    relatedCategories,
  };
}

export async function getAllVehicleAccessoryComboPairsForSSG(): Promise<
  Array<{ vehicle: string; category: string }>
> {
  const [allFitments, catalogueVariants] = await Promise.all([
    prisma.accessoryFitment.findMany({
      where: { vehicleVariantId: { not: null }, accessory: { status: "ACTIVE" } },
      select: {
        vehicleVariantId: true,
        accessory: { select: { category: { select: { slug: true } } } },
      },
    }),
    prisma.vehicleVariant.findMany({
      where: { status: "CATALOGUE" },
      select: {
        id: true,
        slug: true,
        model: { select: { slug: true, make: { select: { slug: true } } } },
      },
    }),
  ]);

  // Count fitments per (vehicleVariantId, categorySlug) pair
  const pairCounts = new Map<string, number>();
  for (const f of allFitments) {
    if (!f.vehicleVariantId) continue;
    const key = `${f.vehicleVariantId}|${f.accessory.category.slug}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const variantById = new Map(catalogueVariants.map((v) => [v.id, v]));

  const result: Array<{ vehicle: string; category: string }> = [];
  for (const [key, count] of pairCounts.entries()) {
    if (count < 3) continue;
    const [variantId, catSlug] = key.split("|");
    const variant = variantById.get(variantId);
    if (!variant) continue;
    result.push({
      vehicle: `${variant.model.make.slug}_${variant.model.slug}_${variant.slug}`,
      category: catSlug,
    });
  }

  return result;
}
