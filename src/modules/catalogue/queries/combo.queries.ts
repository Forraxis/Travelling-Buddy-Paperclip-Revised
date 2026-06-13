import { prisma } from '@/lib/db';
import type {
  VehicleVariantDto,
  VehicleMakeDto,
  VehicleModelDto,
} from '../types/vehicle.types';
import type {
  CaravanVariantDto,
  CaravanMakeDto,
  CaravanModelDto,
} from '../types/caravan.types';

// ── Compound slug helpers ────────────────────────────────────────────────────
// URL form: {makeSlug}_{modelSlug}_{variantSlug}
// Make/model/variant slugs use only [a-z0-9-], so _ is a safe separator.

export function buildComboSlug(
  makeSlug: string,
  modelSlug: string,
  variantSlug: string,
): string {
  return `${makeSlug}_${modelSlug}_${variantSlug}`;
}

export function parseComboSlug(
  compound: string,
): { makeSlug: string; modelSlug: string; variantSlug: string } | null {
  const idx1 = compound.indexOf('_');
  if (idx1 === -1) return null;
  const idx2 = compound.indexOf('_', idx1 + 1);
  if (idx2 === -1) return null;
  return {
    makeSlug: compound.slice(0, idx1),
    modelSlug: compound.slice(idx1 + 1, idx2),
    variantSlug: compound.slice(idx2 + 1),
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ComboVariantMini {
  id: string;
  name: string;
  slug: string;
  makeSlug: string;
  modelSlug: string;
  makeName: string;
  modelName: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}

export type ComboVehicleVariant = VehicleVariantDto & {
  model: VehicleModelDto & { make: VehicleMakeDto };
};

export type ComboCaravanVariant = CaravanVariantDto & {
  model: CaravanModelDto & { make: CaravanMakeDto };
};

export interface ComboPageData {
  vehicle: ComboVehicleVariant;
  caravan: ComboCaravanVariant;
  altCaravans: ComboVariantMini[];
  altVehicles: ComboVariantMini[];
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getComboPageData(
  vehicleCompound: string,
  caravanCompound: string,
): Promise<ComboPageData | null> {
  const vParsed = parseComboSlug(vehicleCompound);
  const cParsed = parseComboSlug(caravanCompound);
  if (!vParsed || !cParsed) return null;

  const [vMake, cMake] = await Promise.all([
    prisma.vehicleMake.findUnique({ where: { slug: vParsed.makeSlug } }),
    prisma.caravanMake.findUnique({ where: { slug: cParsed.makeSlug } }),
  ]);
  if (!vMake || !cMake) return null;

  const [vModel, cModel] = await Promise.all([
    prisma.vehicleModel.findUnique({
      where: { makeId_slug: { makeId: vMake.id, slug: vParsed.modelSlug } },
    }),
    prisma.caravanModel.findUnique({
      where: { makeId_slug: { makeId: cMake.id, slug: cParsed.modelSlug } },
    }),
  ]);
  if (!vModel || !cModel) return null;

  const [vehicle, caravan] = await Promise.all([
    prisma.vehicleVariant.findUnique({
      where: {
        modelId_slug: { modelId: vModel.id, slug: vParsed.variantSlug },
      },
      include: { model: { include: { make: true } } },
    }),
    prisma.caravanVariant.findUnique({
      where: {
        modelId_slug: { modelId: cModel.id, slug: cParsed.variantSlug },
      },
      include: { model: { include: { make: true } } },
    }),
  ]);
  if (!vehicle || !caravan) return null;

  const maxTowing = vehicle.maxTowingCapacityKg ?? 0;
  const caravanAtm = caravan.atmKg ?? 0;

  const [altCaravansRaw, altVehiclesRaw] = await Promise.all([
    prisma.caravanVariant.findMany({
      where: {
        status: 'CATALOGUE',
        id: { not: caravan.id },
        atmKg: { not: null, lte: maxTowing },
      },
      orderBy: { atmKg: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        slug: true,
        yearFrom: true,
        yearTo: true,
        isCurrentProduction: true,
        model: {
          select: {
            slug: true,
            name: true,
            make: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    prisma.vehicleVariant.findMany({
      where: {
        status: 'CATALOGUE',
        id: { not: vehicle.id },
        maxTowingCapacityKg: {
          not: null,
          gte: Math.floor(caravanAtm * 0.8),
        },
      },
      orderBy: { maxTowingCapacityKg: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        slug: true,
        yearFrom: true,
        yearTo: true,
        isCurrentProduction: true,
        model: {
          select: {
            slug: true,
            name: true,
            make: { select: { slug: true, name: true } },
          },
        },
      },
    }),
  ]);

  const toMini = (v: {
    id: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    model: { slug: string; name: string; make: { slug: string; name: string } };
  }): ComboVariantMini => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    makeSlug: v.model.make.slug,
    modelSlug: v.model.slug,
    makeName: v.model.make.name,
    modelName: v.model.name,
    yearFrom: v.yearFrom,
    yearTo: v.yearTo,
    isCurrentProduction: v.isCurrentProduction,
  });

  return {
    vehicle,
    caravan,
    altCaravans: altCaravansRaw.map(toMini),
    altVehicles: altVehiclesRaw.map(toMini),
  };
}

export async function getAllComboSlugsForSSG(): Promise<
  Array<{ vehicle: string; caravan: string }>
> {
  const [vehicles, caravans] = await Promise.all([
    prisma.vehicleVariant.findMany({
      where: { status: 'CATALOGUE', maxTowingCapacityKg: { not: null } },
      select: {
        slug: true,
        maxTowingCapacityKg: true,
        model: { select: { slug: true, make: { select: { slug: true } } } },
      },
    }),
    prisma.caravanVariant.findMany({
      where: { status: 'CATALOGUE', atmKg: { not: null } },
      select: {
        slug: true,
        atmKg: true,
        model: { select: { slug: true, make: { select: { slug: true } } } },
      },
    }),
  ]);

  const result: Array<{ vehicle: string; caravan: string }> = [];
  for (const v of vehicles) {
    for (const c of caravans) {
      if ((v.maxTowingCapacityKg ?? 0) >= (c.atmKg ?? 0) * 0.8) {
        result.push({
          vehicle: buildComboSlug(v.model.make.slug, v.model.slug, v.slug),
          caravan: buildComboSlug(c.model.make.slug, c.model.slug, c.slug),
        });
      }
    }
  }

  return result;
}
