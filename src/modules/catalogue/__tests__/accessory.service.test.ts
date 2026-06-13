import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAccessoryService } from '../services/accessory.service';
import type { AccessoryService } from '../services/accessory.service';

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
  return { accessory: makePrismaModel() };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date('2026-01-01T00:00:00Z');

function makeDecimal(n: number) {
  return { toNumber: () => n };
}

const ACCESSORY_ARB = {
  id: 'acc-1',
  brandId: 'brand-1',
  categoryId: 'cat-1',
  name: 'ARB Bullbar',
  slug: 'arb-bullbar',
  description: 'Heavy duty steel bullbar',
  imageUrls: [],
  priceMin: makeDecimal(1200),
  priceMax: makeDecimal(1800),
  currencyCode: 'AUD',
  affiliateUrl: null,
  status: 'ACTIVE' as const,
  market: 'AU' as const,
  createdAt: now,
  updatedAt: now,
};

let prisma: MockPrisma;
let service: AccessoryService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createAccessoryService(prisma as never);
});

// ── CRUD ───────────────────────────────────────────

describe('Accessory CRUD', () => {
  it('create calls prisma.accessory.create and converts Decimal', async () => {
    prisma.accessory.create.mockResolvedValue(ACCESSORY_ARB);
    const result = await service.create({
      brandId: 'brand-1',
      categoryId: 'cat-1',
      name: 'ARB Bullbar',
      slug: 'arb-bullbar',
    });
    expect(prisma.accessory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'ARB Bullbar' }),
    });
    expect(result.priceMin).toBe(1200);
    expect(result.priceMax).toBe(1800);
  });

  it('update calls prisma.accessory.update', async () => {
    const updated = { ...ACCESSORY_ARB, name: 'ARB Summit Bullbar' };
    prisma.accessory.update.mockResolvedValue(updated);
    const result = await service.update('acc-1', {
      name: 'ARB Summit Bullbar',
    });
    expect(result.name).toBe('ARB Summit Bullbar');
    expect(prisma.accessory.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { name: 'ARB Summit Bullbar' },
    });
  });

  it('remove calls prisma.accessory.delete', async () => {
    prisma.accessory.delete.mockResolvedValue(ACCESSORY_ARB);
    await service.remove('acc-1');
    expect(prisma.accessory.delete).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
    });
  });

  it('getById returns accessory with converted Decimal', async () => {
    prisma.accessory.findUnique.mockResolvedValue(ACCESSORY_ARB);
    const result = await service.getById('acc-1');
    expect(result).not.toBeNull();
    expect(result!.priceMin).toBe(1200);
    expect(result!.priceMax).toBe(1800);
  });

  it('getById returns null for non-existent id', async () => {
    prisma.accessory.findUnique.mockResolvedValue(null);
    expect(await service.getById('nope')).toBeNull();
  });

  it('getBySlug looks up by brandId_slug compound unique', async () => {
    prisma.accessory.findUnique.mockResolvedValue(ACCESSORY_ARB);
    const result = await service.getBySlug('brand-1', 'arb-bullbar');
    expect(result?.slug).toBe('arb-bullbar');
    expect(prisma.accessory.findUnique).toHaveBeenCalledWith({
      where: { brandId_slug: { brandId: 'brand-1', slug: 'arb-bullbar' } },
    });
  });

  it('getBySlug returns null for unknown slug', async () => {
    prisma.accessory.findUnique.mockResolvedValue(null);
    expect(await service.getBySlug('brand-1', 'nope')).toBeNull();
  });
});

// ── Decimal conversion ─────────────────────────────

describe('Accessory Decimal conversion', () => {
  it('converts null priceMin/priceMax to null', async () => {
    const noPrice = { ...ACCESSORY_ARB, priceMin: null, priceMax: null };
    prisma.accessory.findUnique.mockResolvedValue(noPrice);
    const result = await service.getById('acc-1');
    expect(result!.priceMin).toBeNull();
    expect(result!.priceMax).toBeNull();
  });
});

// ── Pagination ─────────────────────────────────────

describe('Accessory pagination', () => {
  it('list returns cursor when more items exist', async () => {
    const items = [
      { ...ACCESSORY_ARB, id: 'a' },
      { ...ACCESSORY_ARB, id: 'b' },
      { ...ACCESSORY_ARB, id: 'c' },
    ];
    prisma.accessory.findMany.mockResolvedValue(items);
    const result = await service.list({}, { limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('b');
  });

  it('list returns no cursor when result fits in limit', async () => {
    prisma.accessory.findMany.mockResolvedValue([ACCESSORY_ARB]);
    const result = await service.list({}, { limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('list uses cursor when provided', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({}, { cursor: 'abc', limit: 10 });
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: 'abc' } }),
    );
  });

  it('list uses default page size', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26 }),
    );
  });
});

// ── Filter ─────────────────────────────────────────

describe('Accessory filtering', () => {
  it('list filters by brandId', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({ brandId: 'brand-1' });
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ brandId: 'brand-1' }),
      }),
    );
  });

  it('list filters by categoryId', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({ categoryId: 'cat-1' });
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 'cat-1' }),
      }),
    );
  });

  it('list filters by vehicleVariantId via fitments relation', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({ vehicleVariantId: 'vv-1' });
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fitments: { some: { vehicleVariantId: 'vv-1' } },
        }),
      }),
    );
  });

  it('list filters by caravanVariantId via fitments relation', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({ caravanVariantId: 'cv-1' });
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fitments: { some: { caravanVariantId: 'cv-1' } },
        }),
      }),
    );
  });

  it('list applies no filter when empty filter object provided', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.list({});
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

// ── Search ─────────────────────────────────────────

describe('Accessory search', () => {
  it('search returns matching accessories', async () => {
    prisma.accessory.findMany.mockResolvedValue([ACCESSORY_ARB]);
    const result = await service.search('bullbar');
    expect(result.accessories).toHaveLength(1);
    expect(result.accessories[0].name).toBe('ARB Bullbar');
  });

  it('search uses case-insensitive contains', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.search('Bullbar');
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: 'Bullbar', mode: 'insensitive' } },
      }),
    );
  });

  it('search respects limit parameter', async () => {
    prisma.accessory.findMany.mockResolvedValue([]);
    await service.search('bar', 5);
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('searchByBrand filters by brandId', async () => {
    prisma.accessory.findMany.mockResolvedValue([ACCESSORY_ARB]);
    const result = await service.searchByBrand('brand-1', 'bullbar');
    expect(result.accessories).toHaveLength(1);
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ brandId: 'brand-1' }),
      }),
    );
  });

  it('searchByCategory filters by categoryId', async () => {
    prisma.accessory.findMany.mockResolvedValue([ACCESSORY_ARB]);
    const result = await service.searchByCategory('cat-1');
    expect(result.accessories).toHaveLength(1);
    expect(prisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 'cat-1' }),
      }),
    );
  });
});
