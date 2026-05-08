import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBrandService } from "../services/brand.service";
import type { BrandService } from "../services/brand.service";

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
  return { accessoryBrand: makePrismaModel() };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date("2026-01-01T00:00:00Z");

const BRAND_ARB = {
  id: "brand-1",
  name: "ARB",
  slug: "arb",
  logoUrl: null,
  websiteUrl: "https://www.arb.com.au",
  status: "ACTIVE" as const,
  isPartner: false,
  createdAt: now,
  updatedAt: now,
};

let prisma: MockPrisma;
let service: BrandService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createBrandService(prisma as never);
});

// ── CRUD ───────────────────────────────────────────

describe("Brand CRUD", () => {
  it("create calls prisma.accessoryBrand.create", async () => {
    prisma.accessoryBrand.create.mockResolvedValue(BRAND_ARB);
    const result = await service.create({ name: "ARB", slug: "arb" });
    expect(result).toEqual(BRAND_ARB);
    expect(prisma.accessoryBrand.create).toHaveBeenCalledWith({
      data: { name: "ARB", slug: "arb" },
    });
  });

  it("update calls prisma.accessoryBrand.update", async () => {
    const updated = { ...BRAND_ARB, isPartner: true };
    prisma.accessoryBrand.update.mockResolvedValue(updated);
    const result = await service.update("brand-1", { isPartner: true });
    expect(result.isPartner).toBe(true);
    expect(prisma.accessoryBrand.update).toHaveBeenCalledWith({
      where: { id: "brand-1" },
      data: { isPartner: true },
    });
  });

  it("remove calls prisma.accessoryBrand.delete", async () => {
    prisma.accessoryBrand.delete.mockResolvedValue(BRAND_ARB);
    await service.remove("brand-1");
    expect(prisma.accessoryBrand.delete).toHaveBeenCalledWith({
      where: { id: "brand-1" },
    });
  });

  it("getById returns brand", async () => {
    prisma.accessoryBrand.findUnique.mockResolvedValue(BRAND_ARB);
    const result = await service.getById("brand-1");
    expect(result).toEqual(BRAND_ARB);
    expect(prisma.accessoryBrand.findUnique).toHaveBeenCalledWith({
      where: { id: "brand-1" },
    });
  });

  it("getById returns null for non-existent brand", async () => {
    prisma.accessoryBrand.findUnique.mockResolvedValue(null);
    const result = await service.getById("nope");
    expect(result).toBeNull();
  });

  it("getBySlug returns brand by slug", async () => {
    prisma.accessoryBrand.findUnique.mockResolvedValue(BRAND_ARB);
    const result = await service.getBySlug("arb");
    expect(result?.slug).toBe("arb");
    expect(prisma.accessoryBrand.findUnique).toHaveBeenCalledWith({
      where: { slug: "arb" },
    });
  });

  it("getBySlug returns null for non-existent slug", async () => {
    prisma.accessoryBrand.findUnique.mockResolvedValue(null);
    const result = await service.getBySlug("nope");
    expect(result).toBeNull();
  });
});

// ── Pagination ─────────────────────────────────────

describe("Brand pagination", () => {
  it("list returns paginated result with cursor when more items exist", async () => {
    const brands = [
      { ...BRAND_ARB, id: "a" },
      { ...BRAND_ARB, id: "b" },
      { ...BRAND_ARB, id: "c" },
    ];
    prisma.accessoryBrand.findMany.mockResolvedValue(brands);
    const result = await service.list({}, { limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("b");
  });

  it("list returns no cursor when no more items", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([BRAND_ARB]);
    const result = await service.list({}, { limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("list uses cursor when provided", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.list({}, { cursor: "abc", limit: 10 });
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, cursor: { id: "abc" } })
    );
  });

  it("list uses default page size when limit not provided", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26 })
    );
  });
});

// ── Filter ─────────────────────────────────────────

describe("Brand filtering", () => {
  it("list filters by status", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.list({ status: "ACTIVE" });
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("list filters by isPartner", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.list({ isPartner: true });
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPartner: true }),
      })
    );
  });

  it("list applies no filter when neither status nor isPartner specified", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.list({});
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

// ── Search ─────────────────────────────────────────

describe("Brand search", () => {
  it("search returns matching brands", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([BRAND_ARB]);
    const result = await service.search("arb");
    expect(result.brands).toHaveLength(1);
    expect(result.brands[0].name).toBe("ARB");
  });

  it("search uses case-insensitive contains", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.search("ARB");
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "ARB", mode: "insensitive" } },
      })
    );
  });

  it("search respects limit parameter", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    await service.search("x", 5);
    expect(prisma.accessoryBrand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it("search returns empty brands array when nothing matches", async () => {
    prisma.accessoryBrand.findMany.mockResolvedValue([]);
    const result = await service.search("zzz");
    expect(result.brands).toHaveLength(0);
  });
});
