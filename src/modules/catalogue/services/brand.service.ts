import type { PrismaClient } from "@prisma/client";
import type {
  AccessoryBrandDto,
  CreateAccessoryBrandInput,
  UpdateAccessoryBrandInput,
  AccessoryBrandFilter,
  PaginationOptions,
  PaginatedResult,
  AccessoryBrandSearchResult,
} from "../types/accessory-brand.types";

const DEFAULT_PAGE_SIZE = 25;

export function createBrandService(prisma: PrismaClient) {
  async function create(
    input: CreateAccessoryBrandInput
  ): Promise<AccessoryBrandDto> {
    return prisma.accessoryBrand.create({ data: input });
  }

  async function update(
    id: string,
    input: UpdateAccessoryBrandInput
  ): Promise<AccessoryBrandDto> {
    return prisma.accessoryBrand.update({ where: { id }, data: input });
  }

  async function remove(id: string): Promise<void> {
    await prisma.accessoryBrand.delete({ where: { id } });
  }

  async function getById(id: string): Promise<AccessoryBrandDto | null> {
    return prisma.accessoryBrand.findUnique({ where: { id } });
  }

  async function getBySlug(slug: string): Promise<AccessoryBrandDto | null> {
    return prisma.accessoryBrand.findUnique({ where: { slug } });
  }

  async function list(
    filter: AccessoryBrandFilter = {},
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<AccessoryBrandDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const where: Record<string, unknown> = {};
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.isPartner !== undefined) where.isPartner = filter.isPartner;

    const items = await prisma.accessoryBrand.findMany({
      where,
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
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

  async function search(
    query: string,
    limit = 10
  ): Promise<AccessoryBrandSearchResult> {
    const brands = await prisma.accessoryBrand.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: limit,
      orderBy: { name: "asc" },
    });
    return { brands };
  }

  return { create, update, remove, getById, getBySlug, list, search };
}

export type BrandService = ReturnType<typeof createBrandService>;
