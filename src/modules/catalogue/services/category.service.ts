import type { PrismaClient } from "@prisma/client";
import type {
  AccessoryCategoryDto,
  AccessoryCategoryWithChildren,
  AccessoryCategoryTree,
  CreateAccessoryCategoryInput,
  UpdateAccessoryCategoryInput,
  AccessoryCategoryFilter,
  PaginationOptions,
  PaginatedResult,
  AccessoryCategorySearchResult,
} from "../types/accessory-category.types";

const DEFAULT_PAGE_SIZE = 25;

export function createCategoryService(prisma: PrismaClient) {
  async function create(
    input: CreateAccessoryCategoryInput
  ): Promise<AccessoryCategoryDto> {
    return prisma.accessoryCategory.create({ data: input });
  }

  async function update(
    id: string,
    input: UpdateAccessoryCategoryInput
  ): Promise<AccessoryCategoryDto> {
    return prisma.accessoryCategory.update({ where: { id }, data: input });
  }

  async function remove(id: string): Promise<void> {
    await prisma.accessoryCategory.delete({ where: { id } });
  }

  async function getById(
    id: string
  ): Promise<AccessoryCategoryWithChildren | null> {
    return prisma.accessoryCategory.findUnique({
      where: { id },
      include: { children: true },
    });
  }

  async function getBySlug(
    slug: string
  ): Promise<AccessoryCategoryWithChildren | null> {
    return prisma.accessoryCategory.findUnique({
      where: { slug },
      include: { children: true },
    });
  }

  async function list(
    filter: AccessoryCategoryFilter = {},
    opts: PaginationOptions = {}
  ): Promise<PaginatedResult<AccessoryCategoryDto>> {
    const limit = opts.limit ?? DEFAULT_PAGE_SIZE;
    const where: Record<string, unknown> = {};
    if ("parentId" in filter) where.parentId = filter.parentId ?? null;

    const items = await prisma.accessoryCategory.findMany({
      where,
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };
  }

  // Returns the full category tree with nested children, built in memory.
  async function listHierarchy(): Promise<AccessoryCategoryTree[]> {
    const all = await prisma.accessoryCategory.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    const map = new Map<string, AccessoryCategoryTree>();
    for (const cat of all) {
      map.set(cat.id, { ...cat, children: [] });
    }

    const roots: AccessoryCategoryTree[] = [];
    for (const node of map.values()) {
      if (node.parentId) {
        map.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async function search(
    query: string,
    limit = 10
  ): Promise<AccessoryCategorySearchResult> {
    const categories = await prisma.accessoryCategory.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return { categories };
  }

  return { create, update, remove, getById, getBySlug, list, listHierarchy, search };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
