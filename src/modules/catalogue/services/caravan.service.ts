import type { PrismaClient } from "@prisma/client";
import type {
  CreateCaravanMakeInput,
  UpdateCaravanMakeInput,
  CreateCaravanModelInput,
  UpdateCaravanModelInput,
  CreateCaravanVariantInput,
  UpdateCaravanVariantInput,
  CaravanMakeDto,
  CaravanMakeWithModels,
  CaravanModelDto,
  CaravanModelWithMake,
  CaravanModelWithVariants,
  CaravanVariantDto,
  CaravanVariantWithModel,
  CaravanVariantFilter,
  PaginationOptions,
  PaginatedResult,
  CaravanSearchResult,
} from "../types/caravan.types";

const DEFAULT_PAGE_SIZE = 25;

export function createCaravanService(prisma: PrismaClient) {
  // ── Makes ──────────────────────────────────────────

  async function createMake(
    input: CreateCaravanMakeInput
  ): Promise<CaravanMakeDto> {
    return prisma.caravanMake.create({ data: input });
  }

  async function updateMake(
    id: string,
    input: UpdateCaravanMakeInput
  ): Promise<CaravanMakeDto> {
    return prisma.caravanMake.update({ where: { id }, data: input });
  }

  async function deleteMake(id: string): Promise<void> {
    await prisma.caravanMake.delete({ where: { id } });
  }

  async function getMakeById(
    id: string
  ): Promise<CaravanMakeWithModels | null> {
    return prisma.caravanMake.findUnique({
      where: { id },
      include: { models: true },
    });
  }

  async function getMakeBySlug(
    slug: string
  ): Promise<CaravanMakeWithModels | null> {
    return prisma.caravanMake.findUnique({
      where: { slug },
      include: { models: true },
    });
  }

  async function listMakes(
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<CaravanMakeDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.caravanMake.findMany({
      take: limit + 1,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      orderBy: { name: "asc" },
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
    input: CreateCaravanModelInput
  ): Promise<CaravanModelDto> {
    return prisma.caravanModel.create({ data: input });
  }

  async function updateModel(
    id: string,
    input: UpdateCaravanModelInput
  ): Promise<CaravanModelDto> {
    return prisma.caravanModel.update({ where: { id }, data: input });
  }

  async function deleteModel(id: string): Promise<void> {
    await prisma.caravanModel.delete({ where: { id } });
  }

  async function getModelById(
    id: string
  ): Promise<CaravanModelWithVariants | null> {
    return prisma.caravanModel.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  async function getModelBySlug(
    makeSlug: string,
    modelSlug: string
  ): Promise<(CaravanModelWithVariants & { make: CaravanMakeDto }) | null> {
    const make = await prisma.caravanMake.findUnique({
      where: { slug: makeSlug },
    });
    if (!make) return null;
    return prisma.caravanModel.findUnique({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
      include: { variants: true, make: true },
    });
  }

  async function listModelsByMake(
    makeId: string,
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<CaravanModelDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.caravanModel.findMany({
      where: { makeId },
      take: limit + 1,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      orderBy: { name: "asc" },
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
    input: CreateCaravanVariantInput
  ): Promise<CaravanVariantDto> {
    return prisma.caravanVariant.create({ data: input });
  }

  async function updateVariant(
    id: string,
    input: UpdateCaravanVariantInput
  ): Promise<CaravanVariantDto> {
    return prisma.caravanVariant.update({ where: { id }, data: input });
  }

  async function deleteVariant(id: string): Promise<void> {
    await prisma.caravanVariant.delete({ where: { id } });
  }

  async function getVariantById(
    id: string
  ): Promise<CaravanVariantWithModel | null> {
    return prisma.caravanVariant.findUnique({
      where: { id },
      include: { model: { include: { make: true } } },
    });
  }

  async function listVariantsByModel(
    modelId: string,
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<CaravanVariantDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const items = await prisma.caravanVariant.findMany({
      where: { modelId },
      take: limit + 1,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      orderBy: [{ yearFrom: "desc" }, { name: "asc" }],
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
    year: number
  ): Promise<CaravanVariantDto[]> {
    return prisma.caravanVariant.findMany({
      where: {
        modelId,
        yearFrom: { lte: year },
        OR: [{ yearTo: { gte: year } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: "desc" },
    });
  }

  async function findVariantsInRange(
    modelId: string,
    yearFrom: number,
    yearTo: number
  ): Promise<CaravanVariantDto[]> {
    return prisma.caravanVariant.findMany({
      where: {
        modelId,
        yearFrom: { lte: yearTo },
        OR: [{ yearTo: { gte: yearFrom } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: "asc" },
    });
  }

  // ── Slug-based lookup ──────────────────────────────

  async function findBySlug(
    makeSlug: string,
    modelSlug: string,
    variantSlug: string
  ): Promise<CaravanVariantWithModel | null> {
    const make = await prisma.caravanMake.findUnique({
      where: { slug: makeSlug },
    });
    if (!make) return null;

    const model = await prisma.caravanModel.findUnique({
      where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
    });
    if (!model) return null;

    return prisma.caravanVariant.findUnique({
      where: { modelId_slug: { modelId: model.id, slug: variantSlug } },
      include: { model: { include: { make: true } } },
    });
  }

  // ── Search ─────────────────────────────────────────

  async function search(
    query: string,
    limit = 10
  ): Promise<CaravanSearchResult> {
    const [makes, models, variants] = await Promise.all([
      prisma.caravanMake.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.caravanModel.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { make: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: { make: true },
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.caravanVariant.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            {
              model: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  {
                    make: {
                      name: { contains: query, mode: "insensitive" },
                    },
                  },
                ],
              },
            },
          ],
        },
        include: { model: { include: { make: true } } },
        take: limit,
        orderBy: { name: "asc" },
      }),
    ]);

    return { makes, models, variants };
  }

  // ── Filtered listing ───────────────────────────────

  async function listVariantsFiltered(
    filter: CaravanVariantFilter,
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<CaravanVariantWithModel>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;

    const where: Record<string, unknown> = {};
    if (filter.market) where.market = filter.market;
    if (filter.axleConfiguration)
      where.axleConfiguration = filter.axleConfiguration;
    if (filter.bodyType) where.model = { bodyType: filter.bodyType };
    if (filter.year) {
      where.yearFrom = { lte: filter.year };
      where.OR = [
        { yearTo: { gte: filter.year } },
        { isCurrentProduction: true },
      ];
    }

    const items = await prisma.caravanVariant.findMany({
      where,
      include: { model: { include: { make: true } } },
      take: limit + 1,
      ...(opts.cursor
        ? { skip: 1, cursor: { id: opts.cursor } }
        : {}),
      orderBy: [{ model: { make: { name: "asc" } } }, { name: "asc" }],
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

export type CaravanService = ReturnType<typeof createCaravanService>;
