import type { PrismaClient } from "@prisma/client";
import type {
  AccessoryDto,
  CreateAccessoryInput,
  UpdateAccessoryInput,
  AccessoryFilter,
  PaginationOptions,
  PaginatedResult,
  AccessorySearchResult,
} from "../types/accessory.types";

const DEFAULT_PAGE_SIZE = 25;

function toDto(raw: {
  priceMin: { toNumber(): number } | null;
  priceMax: { toNumber(): number } | null;
  [key: string]: unknown;
}): AccessoryDto {
  return {
    ...(raw as unknown as AccessoryDto),
    priceMin: raw.priceMin ? raw.priceMin.toNumber() : null,
    priceMax: raw.priceMax ? raw.priceMax.toNumber() : null,
  };
}

export function createAccessoryService(prisma: PrismaClient) {
  async function create(input: CreateAccessoryInput): Promise<AccessoryDto> {
    const raw = await prisma.accessory.create({ data: input as never });
    return toDto(raw as never);
  }

  async function update(
    id: string,
    input: UpdateAccessoryInput
  ): Promise<AccessoryDto> {
    const raw = await prisma.accessory.update({
      where: { id },
      data: input as never,
    });
    return toDto(raw as never);
  }

  async function remove(id: string): Promise<void> {
    await prisma.accessory.delete({ where: { id } });
  }

  async function getById(id: string): Promise<AccessoryDto | null> {
    const raw = await prisma.accessory.findUnique({ where: { id } });
    return raw ? toDto(raw as never) : null;
  }

  async function getBySlug(
    brandId: string,
    slug: string
  ): Promise<AccessoryDto | null> {
    const raw = await prisma.accessory.findUnique({
      where: { brandId_slug: { brandId, slug } },
    });
    return raw ? toDto(raw as never) : null;
  }

  async function list(
    filter: AccessoryFilter = {},
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<AccessoryDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const where: Record<string, unknown> = {};

    if (filter.brandId !== undefined) where.brandId = filter.brandId;
    if (filter.categoryId !== undefined) where.categoryId = filter.categoryId;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.market !== undefined) where.market = filter.market;

    if (filter.vehicleVariantId !== undefined) {
      where.fitments = { some: { vehicleVariantId: filter.vehicleVariantId } };
    } else if (filter.caravanVariantId !== undefined) {
      where.fitments = { some: { caravanVariantId: filter.caravanVariantId } };
    }

    const items = await prisma.accessory.findMany({
      where,
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: { name: "asc" },
    });

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return {
      items: items.map((r) => toDto(r as never)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  async function search(
    query: string,
    limit = 10
  ): Promise<AccessorySearchResult> {
    const accessories = await prisma.accessory.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: limit,
      orderBy: { name: "asc" },
    });
    return { accessories: accessories.map((r) => toDto(r as never)) };
  }

  async function searchByBrand(
    brandId: string,
    query?: string,
    limit = 10
  ): Promise<AccessorySearchResult> {
    const accessories = await prisma.accessory.findMany({
      where: {
        brandId,
        ...(query
          ? { name: { contains: query, mode: "insensitive" } }
          : {}),
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    return { accessories: accessories.map((r) => toDto(r as never)) };
  }

  async function searchByCategory(
    categoryId: string,
    query?: string,
    limit = 10
  ): Promise<AccessorySearchResult> {
    const accessories = await prisma.accessory.findMany({
      where: {
        categoryId,
        ...(query
          ? { name: { contains: query, mode: "insensitive" } }
          : {}),
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    return { accessories: accessories.map((r) => toDto(r as never)) };
  }

  return {
    create,
    update,
    remove,
    getById,
    getBySlug,
    list,
    search,
    searchByBrand,
    searchByCategory,
  };
}

export type AccessoryService = ReturnType<typeof createAccessoryService>;
