import type { PrismaClient } from '@prisma/client';
import type {
  CreateVehicleMakeInput,
  UpdateVehicleMakeInput,
  CreateVehicleModelInput,
  UpdateVehicleModelInput,
  CreateVehicleVariantInput,
  UpdateVehicleVariantInput,
  VehicleMakeDto,
  VehicleMakeWithModels,
  VehicleModelDto,
  VehicleModelWithMake,
  VehicleModelWithVariants,
  VehicleVariantDto,
  VehicleVariantWithModel,
  VehicleVariantFilter,
  PaginationOptions,
  PaginatedResult,
  VehicleSearchResult,
} from '../types/vehicle.types';

const DEFAULT_PAGE_SIZE = 25;

export function createVehicleService(prisma: PrismaClient) {
  // ── Makes ──────────────────────────────────────────

  async function createMake(
    input: CreateVehicleMakeInput,
  ): Promise<VehicleMakeDto> {
    return prisma.vehicleMake.create({ data: input });
  }

  async function updateMake(
    id: string,
    input: UpdateVehicleMakeInput,
  ): Promise<VehicleMakeDto> {
    return prisma.vehicleMake.update({ where: { id }, data: input });
  }

  async function deleteMake(id: string): Promise<void> {
    await prisma.vehicleMake.delete({ where: { id } });
  }

  async function getMakeById(
    id: string,
  ): Promise<VehicleMakeWithModels | null> {
    return prisma.vehicleMake.findUnique({
      where: { id },
      include: { models: true },
    });
  }

  async function getMakeBySlug(
    slug: string,
  ): Promise<VehicleMakeWithModels | null> {
    return prisma.vehicleMake.findUnique({
      where: { slug },
      include: { models: true },
    });
  }

  async function listMakes(
    opts: PaginationOptions = {},
  ): Promise<PaginatedResult<VehicleMakeDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.vehicleMake.findMany({
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: { name: 'asc' },
    });
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  // ── Models ─────────────────────────────────────────

  async function createModel(
    input: CreateVehicleModelInput,
  ): Promise<VehicleModelDto> {
    return prisma.vehicleModel.create({ data: input });
  }

  async function updateModel(
    id: string,
    input: UpdateVehicleModelInput,
  ): Promise<VehicleModelDto> {
    return prisma.vehicleModel.update({ where: { id }, data: input });
  }

  async function deleteModel(id: string): Promise<void> {
    await prisma.vehicleModel.delete({ where: { id } });
  }

  async function getModelById(
    id: string,
  ): Promise<VehicleModelWithVariants | null> {
    return prisma.vehicleModel.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  async function getModelBySlug(
    makeSlug: string,
    modelSlug: string,
  ): Promise<(VehicleModelWithVariants & { make: VehicleMakeDto }) | null> {
    const make = await prisma.vehicleMake.findUnique({
      where: { slug: makeSlug },
    });
    if (!make) return null;
    return prisma.vehicleModel.findUnique({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
      include: { variants: true, make: true },
    });
  }

  async function listModelsByMake(
    makeId: string,
    opts: PaginationOptions = {},
  ): Promise<PaginatedResult<VehicleModelDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.vehicleModel.findMany({
      where: { makeId },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: { name: 'asc' },
    });
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  // ── Variants ───────────────────────────────────────

  async function createVariant(
    input: CreateVehicleVariantInput,
  ): Promise<VehicleVariantDto> {
    return prisma.vehicleVariant.create({ data: input });
  }

  async function updateVariant(
    id: string,
    input: UpdateVehicleVariantInput,
  ): Promise<VehicleVariantDto> {
    return prisma.vehicleVariant.update({ where: { id }, data: input });
  }

  async function deleteVariant(id: string): Promise<void> {
    await prisma.vehicleVariant.delete({ where: { id } });
  }

  async function getVariantById(
    id: string,
  ): Promise<VehicleVariantWithModel | null> {
    return prisma.vehicleVariant.findUnique({
      where: { id },
      include: {
        model: { include: { make: true } },
        // P3: the published per-model correction the live calc folds in.
        calibrationCorrection: {
          select: {
            kerbMassDeltaKg: true,
            kerbMassApplied: true,
            cogFractionDelta: true,
            cogApplied: true,
          },
        },
      },
    });
  }

  async function listVariantsByModel(
    modelId: string,
    opts: PaginationOptions = {},
  ): Promise<PaginatedResult<VehicleVariantDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.vehicleVariant.findMany({
      // Public API: only published CATALOGUE variants. COMMUNITY variants
      // (user submissions + admin spec candidates) must never leak here — they
      // are scoped to their submitter via the picker routes.
      where: { modelId, status: 'CATALOGUE' },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: [{ yearFrom: 'desc' }, { name: 'asc' }],
    });
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  // ── Year-range queries ─────────────────────────────

  async function findVariantByYear(
    modelId: string,
    year: number,
  ): Promise<VehicleVariantDto[]> {
    return prisma.vehicleVariant.findMany({
      where: {
        modelId,
        yearFrom: { lte: year },
        OR: [{ yearTo: { gte: year } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: 'desc' },
    });
  }

  async function findVariantsInRange(
    modelId: string,
    yearFrom: number,
    yearTo: number,
  ): Promise<VehicleVariantDto[]> {
    return prisma.vehicleVariant.findMany({
      where: {
        modelId,
        yearFrom: { lte: yearTo },
        OR: [{ yearTo: { gte: yearFrom } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: 'asc' },
    });
  }

  // ── Slug-based lookup ──────────────────────────────

  async function findBySlug(
    makeSlug: string,
    modelSlug: string,
    variantSlug: string,
  ): Promise<VehicleVariantWithModel | null> {
    const make = await prisma.vehicleMake.findUnique({
      where: { slug: makeSlug },
    });
    if (!make) return null;

    const model = await prisma.vehicleModel.findUnique({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
    });
    if (!model) return null;

    return prisma.vehicleVariant.findUnique({
      where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
      include: { model: { include: { make: true } } },
    });
  }

  // ── Search ─────────────────────────────────────────

  async function search(
    query: string,
    limit = 10,
  ): Promise<VehicleSearchResult> {
    const [makes, models, variants] = await Promise.all([
      prisma.vehicleMake.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.vehicleModel.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { make: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: { make: true },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.vehicleVariant.findMany({
        where: {
          // Public search: published CATALOGUE variants only (no COMMUNITY leak).
          status: 'CATALOGUE',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            {
              model: {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  {
                    make: {
                      name: { contains: query, mode: 'insensitive' },
                    },
                  },
                ],
              },
            },
          ],
        },
        include: { model: { include: { make: true } } },
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);

    return { makes, models, variants };
  }

  // ── Filtered listing ───────────────────────────────

  async function listVariantsFiltered(
    filter: VehicleVariantFilter,
    opts: PaginationOptions = {},
  ): Promise<PaginatedResult<VehicleVariantWithModel>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;

    const where: Record<string, unknown> = {};
    if (filter.market) where.market = filter.market;
    if (filter.fuelType) where.fuelType = filter.fuelType;
    if (filter.bodyType) where.model = { bodyType: filter.bodyType };
    if (filter.year) {
      where.yearFrom = { lte: filter.year };
      where.OR = [
        { yearTo: { gte: filter.year } },
        { isCurrentProduction: true },
      ];
    }

    const items = await prisma.vehicleVariant.findMany({
      where,
      include: { model: { include: { make: true } } },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: [{ model: { make: { name: 'asc' } } }, { name: 'asc' }],
    });
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  return {
    createMake,
    updateMake,
    deleteMake,
    getMakeById,
    getMakeBySlug,
    listMakes,

    createModel,
    updateModel,
    deleteModel,
    getModelById,
    getModelBySlug,
    listModelsByMake,

    createVariant,
    updateVariant,
    deleteVariant,
    getVariantById,
    listVariantsByModel,

    findVariantByYear,
    findVariantsInRange,

    findBySlug,

    search,

    listVariantsFiltered,
  };
}

export type VehicleService = ReturnType<typeof createVehicleService>;
