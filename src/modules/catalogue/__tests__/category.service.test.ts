import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCategoryService } from '../services/category.service';
import type { CategoryService } from '../services/category.service';

function makePrismaModel() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };
}

function createMockPrisma() {
  return { accessoryCategory: makePrismaModel() };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date('2026-01-01T00:00:00Z');

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    name: 'Roof Racks',
    slug: 'roof-racks',
    description: null,
    parentId: null,
    displayOrder: 0,
    iconName: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const CAT_ROOT = makeCategory();
const CAT_CHILD = makeCategory({
  id: 'cat-2',
  name: 'Flat Racks',
  slug: 'flat-racks',
  parentId: 'cat-1',
});

let prisma: MockPrisma;
let service: CategoryService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createCategoryService(prisma as never);
});

// ── CRUD ───────────────────────────────────────────

describe('Category CRUD', () => {
  it('create calls prisma.accessoryCategory.create', async () => {
    prisma.accessoryCategory.create.mockResolvedValue(CAT_ROOT);
    const result = await service.create({
      name: 'Roof Racks',
      slug: 'roof-racks',
    });
    expect(result).toEqual(CAT_ROOT);
    expect(prisma.accessoryCategory.create).toHaveBeenCalledWith({
      data: { name: 'Roof Racks', slug: 'roof-racks' },
    });
  });

  it('update calls prisma.accessoryCategory.update', async () => {
    const updated = { ...CAT_ROOT, displayOrder: 5 };
    prisma.accessoryCategory.update.mockResolvedValue(updated);
    const result = await service.update('cat-1', { displayOrder: 5 });
    expect(result.displayOrder).toBe(5);
    expect(prisma.accessoryCategory.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { displayOrder: 5 },
    });
  });

  it('remove calls prisma.accessoryCategory.delete', async () => {
    prisma.accessoryCategory.delete.mockResolvedValue(CAT_ROOT);
    await service.remove('cat-1');
    expect(prisma.accessoryCategory.delete).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
    });
  });

  it('getById returns category with children', async () => {
    prisma.accessoryCategory.findUnique.mockResolvedValue({
      ...CAT_ROOT,
      children: [CAT_CHILD],
    });
    const result = await service.getById('cat-1');
    expect(result?.children).toHaveLength(1);
    expect(prisma.accessoryCategory.findUnique).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      include: { children: true },
    });
  });

  it('getById returns null for non-existent category', async () => {
    prisma.accessoryCategory.findUnique.mockResolvedValue(null);
    const result = await service.getById('nope');
    expect(result).toBeNull();
  });

  it('getBySlug returns category with children', async () => {
    prisma.accessoryCategory.findUnique.mockResolvedValue({
      ...CAT_ROOT,
      children: [],
    });
    const result = await service.getBySlug('roof-racks');
    expect(result?.slug).toBe('roof-racks');
    expect(prisma.accessoryCategory.findUnique).toHaveBeenCalledWith({
      where: { slug: 'roof-racks' },
      include: { children: true },
    });
  });

  it('getBySlug returns null for non-existent slug', async () => {
    prisma.accessoryCategory.findUnique.mockResolvedValue(null);
    const result = await service.getBySlug('nope');
    expect(result).toBeNull();
  });
});

// ── Pagination ─────────────────────────────────────

describe('Category pagination', () => {
  it('list returns paginated result with cursor when more items exist', async () => {
    const cats = [
      makeCategory({ id: 'a' }),
      makeCategory({ id: 'b' }),
      makeCategory({ id: 'c' }),
    ];
    prisma.accessoryCategory.findMany.mockResolvedValue(cats);
    const result = await service.list({}, { limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('b');
  });

  it('list returns no cursor when no more items', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_ROOT]);
    const result = await service.list({}, { limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('list uses cursor when provided', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    await service.list({}, { cursor: 'abc', limit: 10 });
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: 'abc' } }),
    );
  });

  it('list uses default page size when limit not provided', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26 }),
    );
  });
});

// ── Filter ─────────────────────────────────────────

describe('Category filtering', () => {
  it('list filters by parentId', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_CHILD]);
    await service.list({ parentId: 'cat-1' });
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: 'cat-1' }),
      }),
    );
  });

  it('list filters root categories when parentId is null', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_ROOT]);
    await service.list({ parentId: null });
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
      }),
    );
  });

  it('list applies no parentId filter when not specified', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    await service.list({});
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

// ── Hierarchy ──────────────────────────────────────

describe('listHierarchy', () => {
  it('builds tree with root and nested children', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_ROOT, CAT_CHILD]);
    const tree = await service.listHierarchy();
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('cat-1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('cat-2');
  });

  it('returns multiple roots when no parentId set', async () => {
    const root2 = makeCategory({
      id: 'cat-3',
      name: 'Bull Bars',
      slug: 'bull-bars',
    });
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_ROOT, root2]);
    const tree = await service.listHierarchy();
    expect(tree).toHaveLength(2);
  });

  it('returns empty array when no categories exist', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    const tree = await service.listHierarchy();
    expect(tree).toHaveLength(0);
  });

  it('handles deeply nested categories', async () => {
    const root = makeCategory({ id: 'r', name: 'Root', slug: 'root' });
    const mid = makeCategory({
      id: 'm',
      name: 'Mid',
      slug: 'mid',
      parentId: 'r',
    });
    const leaf = makeCategory({
      id: 'l',
      name: 'Leaf',
      slug: 'leaf',
      parentId: 'm',
    });
    prisma.accessoryCategory.findMany.mockResolvedValue([root, mid, leaf]);
    const tree = await service.listHierarchy();
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe('l');
  });
});

// ── Search ─────────────────────────────────────────

describe('Category search', () => {
  it('search returns matching categories', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([CAT_ROOT]);
    const result = await service.search('roof');
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Roof Racks');
  });

  it('search uses case-insensitive contains on name and description', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    await service.search('ROOF');
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'ROOF', mode: 'insensitive' } },
            { description: { contains: 'ROOF', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('search respects limit parameter', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    await service.search('x', 3);
    expect(prisma.accessoryCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('search returns empty array when nothing matches', async () => {
    prisma.accessoryCategory.findMany.mockResolvedValue([]);
    const result = await service.search('zzz');
    expect(result.categories).toHaveLength(0);
  });
});
