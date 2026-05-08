import { describe, it, expect, beforeEach, vi } from "vitest";
import { createVehicleService } from "../services/vehicle.service";
import type { VehicleService } from "../services/vehicle.service";

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
  return {
    vehicleMake: makePrismaModel(),
    vehicleModel: makePrismaModel(),
    vehicleVariant: makePrismaModel(),
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date("2026-01-01T00:00:00Z");

const MAKE_TOYOTA = {
  id: "make-1",
  name: "Toyota",
  slug: "toyota",
  logoUrl: null,
  countryOfOrigin: "Japan",
  createdAt: now,
  updatedAt: now,
};

const MODEL_HILUX = {
  id: "model-1",
  makeId: "make-1",
  name: "HiLux",
  slug: "hilux",
  bodyType: "DUAL_CAB_UTE" as const,
  createdAt: now,
  updatedAt: now,
};

function makeVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    modelId: "model-1",
    yearFrom: 2021,
    yearTo: 2024,
    isCurrentProduction: false,
    name: "SR5 4x4",
    slug: "sr5-4x4-2021-2024",
    gvmKg: 3200,
    gcmKg: 5950,
    kerbWeightKg: 2100,
    maxTowingCapacityKg: 3500,
    frontAxleLimitKg: 1350,
    rearAxleLimitKg: 1900,
    wheelbaseMm: 3085,
    frontOverhangMm: null,
    rearOverhangMm: null,
    totalLengthMm: null,
    maxTowBallDownloadKg: 350,
    fuelTankCapacityL: 80,
    fuelType: "DIESEL" as const,
    market: "AU" as const,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let prisma: MockPrisma;
let service: VehicleService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createVehicleService(prisma as never);
});

// ── Makes ──────────────────────────────────────────

describe("Makes CRUD", () => {
  it("createMake calls prisma.vehicleMake.create", async () => {
    prisma.vehicleMake.create.mockResolvedValue(MAKE_TOYOTA);
    const result = await service.createMake({
      name: "Toyota",
      slug: "toyota",
    });
    expect(result).toEqual(MAKE_TOYOTA);
    expect(prisma.vehicleMake.create).toHaveBeenCalledWith({
      data: { name: "Toyota", slug: "toyota" },
    });
  });

  it("updateMake calls prisma.vehicleMake.update", async () => {
    const updated = { ...MAKE_TOYOTA, name: "TOYOTA" };
    prisma.vehicleMake.update.mockResolvedValue(updated);
    const result = await service.updateMake("make-1", { name: "TOYOTA" });
    expect(result.name).toBe("TOYOTA");
  });

  it("deleteMake calls prisma.vehicleMake.delete", async () => {
    prisma.vehicleMake.delete.mockResolvedValue(MAKE_TOYOTA);
    await service.deleteMake("make-1");
    expect(prisma.vehicleMake.delete).toHaveBeenCalledWith({
      where: { id: "make-1" },
    });
  });

  it("getMakeById returns make with models", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue({
      ...MAKE_TOYOTA,
      models: [MODEL_HILUX],
    });
    const result = await service.getMakeById("make-1");
    expect(result?.models).toHaveLength(1);
  });

  it("getMakeBySlug returns make with models", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue({
      ...MAKE_TOYOTA,
      models: [],
    });
    const result = await service.getMakeBySlug("toyota");
    expect(result?.slug).toBe("toyota");
  });

  it("getMakeById returns null for non-existent make", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(null);
    const result = await service.getMakeById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("Makes pagination", () => {
  it("listMakes returns paginated result with cursor", async () => {
    const makes = [
      { ...MAKE_TOYOTA, id: "a" },
      { ...MAKE_TOYOTA, id: "b" },
      { ...MAKE_TOYOTA, id: "c" },
    ];
    prisma.vehicleMake.findMany.mockResolvedValue(makes);
    const result = await service.listMakes({ limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("b");
  });

  it("listMakes returns no cursor when no more items", async () => {
    prisma.vehicleMake.findMany.mockResolvedValue([MAKE_TOYOTA]);
    const result = await service.listMakes({ limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("listMakes uses cursor when provided", async () => {
    prisma.vehicleMake.findMany.mockResolvedValue([]);
    await service.listMakes({ cursor: "abc", limit: 10 });
    expect(prisma.vehicleMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: "abc" },
      })
    );
  });
});

// ── Models ─────────────────────────────────────────

describe("Models CRUD", () => {
  it("createModel calls prisma.vehicleModel.create", async () => {
    prisma.vehicleModel.create.mockResolvedValue(MODEL_HILUX);
    const result = await service.createModel({
      makeId: "make-1",
      name: "HiLux",
      slug: "hilux",
      bodyType: "DUAL_CAB_UTE",
    });
    expect(result).toEqual(MODEL_HILUX);
  });

  it("updateModel calls prisma.vehicleModel.update", async () => {
    prisma.vehicleModel.update.mockResolvedValue({
      ...MODEL_HILUX,
      name: "HiLux SR",
    });
    const result = await service.updateModel("model-1", { name: "HiLux SR" });
    expect(result.name).toBe("HiLux SR");
  });

  it("deleteModel calls prisma.vehicleModel.delete", async () => {
    prisma.vehicleModel.delete.mockResolvedValue(MODEL_HILUX);
    await service.deleteModel("model-1");
    expect(prisma.vehicleModel.delete).toHaveBeenCalledWith({
      where: { id: "model-1" },
    });
  });

  it("getModelById returns model with variants", async () => {
    prisma.vehicleModel.findUnique.mockResolvedValue({
      ...MODEL_HILUX,
      variants: [makeVariant()],
    });
    const result = await service.getModelById("model-1");
    expect(result?.variants).toHaveLength(1);
  });

  it("getModelBySlug resolves make first then finds model", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(MAKE_TOYOTA);
    prisma.vehicleModel.findUnique.mockResolvedValue({
      ...MODEL_HILUX,
      variants: [],
      make: MAKE_TOYOTA,
    });
    const result = await service.getModelBySlug("toyota", "hilux");
    expect(result?.slug).toBe("hilux");
    expect(prisma.vehicleModel.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { makeId_slug: { makeId: "make-1", slug: "hilux" } },
      })
    );
  });

  it("getModelBySlug returns null if make not found", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(null);
    const result = await service.getModelBySlug("nope", "hilux");
    expect(result).toBeNull();
  });
});

describe("Models pagination", () => {
  it("listModelsByMake filters by makeId", async () => {
    prisma.vehicleModel.findMany.mockResolvedValue([MODEL_HILUX]);
    await service.listModelsByMake("make-1");
    expect(prisma.vehicleModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { makeId: "make-1" } })
    );
  });
});

// ── Variants ───────────────────────────────────────

describe("Variants CRUD", () => {
  it("createVariant calls prisma.vehicleVariant.create", async () => {
    const v = makeVariant();
    prisma.vehicleVariant.create.mockResolvedValue(v);
    const result = await service.createVariant({
      modelId: "model-1",
      yearFrom: 2021,
      yearTo: 2024,
      name: "SR5 4x4",
      slug: "sr5-4x4-2021-2024",
      gvmKg: 3200,
      gcmKg: 5950,
      kerbWeightKg: 2100,
      maxTowingCapacityKg: 3500,
      frontAxleLimitKg: 1350,
      rearAxleLimitKg: 1900,
      wheelbaseMm: 3085,
      maxTowBallDownloadKg: 350,
      fuelTankCapacityL: 80,
      fuelType: "DIESEL",
    });
    expect(result.id).toBe("variant-1");
  });

  it("updateVariant calls prisma.vehicleVariant.update", async () => {
    prisma.vehicleVariant.update.mockResolvedValue(
      makeVariant({ yearTo: 2025 })
    );
    const result = await service.updateVariant("variant-1", { yearTo: 2025 });
    expect(result.yearTo).toBe(2025);
  });

  it("deleteVariant calls prisma.vehicleVariant.delete", async () => {
    prisma.vehicleVariant.delete.mockResolvedValue(makeVariant());
    await service.deleteVariant("variant-1");
    expect(prisma.vehicleVariant.delete).toHaveBeenCalledWith({
      where: { id: "variant-1" },
    });
  });

  it("getVariantById includes model and make", async () => {
    prisma.vehicleVariant.findUnique.mockResolvedValue({
      ...makeVariant(),
      model: { ...MODEL_HILUX, make: MAKE_TOYOTA },
    });
    const result = await service.getVariantById("variant-1");
    expect(result?.model.make.name).toBe("Toyota");
  });
});

// ── Year-range queries ─────────────────────────────

describe("findVariantByYear", () => {
  it("finds variant covering the given year", async () => {
    const v = makeVariant({ yearFrom: 2021, yearTo: 2024 });
    prisma.vehicleVariant.findMany.mockResolvedValue([v]);
    const result = await service.findVariantByYear("model-1", 2022);
    expect(result).toHaveLength(1);
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith({
      where: {
        modelId: "model-1",
        yearFrom: { lte: 2022 },
        OR: [{ yearTo: { gte: 2022 } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: "desc" },
    });
  });

  it("includes current-production variants even if yearTo < year", async () => {
    const currentProd = makeVariant({
      id: "variant-cp",
      yearFrom: 2024,
      yearTo: 2024,
      isCurrentProduction: true,
    });
    prisma.vehicleVariant.findMany.mockResolvedValue([currentProd]);
    const result = await service.findVariantByYear("model-1", 2026);
    expect(result).toHaveLength(1);
  });

  it("returns empty for year before any variant", async () => {
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    const result = await service.findVariantByYear("model-1", 2000);
    expect(result).toHaveLength(0);
  });

  it("handles single-year variant (yearFrom === yearTo)", async () => {
    const singleYear = makeVariant({
      yearFrom: 2023,
      yearTo: 2023,
    });
    prisma.vehicleVariant.findMany.mockResolvedValue([singleYear]);
    const result = await service.findVariantByYear("model-1", 2023);
    expect(result).toHaveLength(1);
  });
});

describe("findVariantsInRange", () => {
  it("finds variants overlapping the given range", async () => {
    const v1 = makeVariant({
      id: "v1",
      yearFrom: 2018,
      yearTo: 2021,
    });
    const v2 = makeVariant({
      id: "v2",
      yearFrom: 2021,
      yearTo: 2024,
    });
    prisma.vehicleVariant.findMany.mockResolvedValue([v1, v2]);
    const result = await service.findVariantsInRange("model-1", 2020, 2023);
    expect(result).toHaveLength(2);
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith({
      where: {
        modelId: "model-1",
        yearFrom: { lte: 2023 },
        OR: [{ yearTo: { gte: 2020 } }, { isCurrentProduction: true }],
      },
      orderBy: { yearFrom: "asc" },
    });
  });

  it("handles adjacent ranges (yearTo of one === yearFrom of next)", async () => {
    const v1 = makeVariant({ id: "v1", yearFrom: 2018, yearTo: 2021 });
    const v2 = makeVariant({ id: "v2", yearFrom: 2021, yearTo: 2024 });
    prisma.vehicleVariant.findMany.mockResolvedValue([v1, v2]);
    const result = await service.findVariantsInRange("model-1", 2021, 2021);
    expect(result).toHaveLength(2);
  });

  it("includes current-production variants in range queries", async () => {
    const cp = makeVariant({
      yearFrom: 2024,
      yearTo: 2024,
      isCurrentProduction: true,
    });
    prisma.vehicleVariant.findMany.mockResolvedValue([cp]);
    const result = await service.findVariantsInRange("model-1", 2024, 2030);
    expect(result).toHaveLength(1);
  });
});

// ── Slug-based lookup ──────────────────────────────

describe("findBySlug", () => {
  it("resolves make → model → variant by slugs", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(MAKE_TOYOTA);
    prisma.vehicleModel.findUnique.mockResolvedValue(MODEL_HILUX);
    prisma.vehicleVariant.findUnique.mockResolvedValue({
      ...makeVariant(),
      model: { ...MODEL_HILUX, make: MAKE_TOYOTA },
    });
    const result = await service.findBySlug("toyota", "hilux", "sr5-4x4-2021-2024");
    expect(result?.slug).toBe("sr5-4x4-2021-2024");
  });

  it("returns null if make slug not found", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("nope", "hilux", "sr5");
    expect(result).toBeNull();
  });

  it("returns null if model slug not found", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(MAKE_TOYOTA);
    prisma.vehicleModel.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("toyota", "nope", "sr5");
    expect(result).toBeNull();
  });

  it("returns null if variant slug not found", async () => {
    prisma.vehicleMake.findUnique.mockResolvedValue(MAKE_TOYOTA);
    prisma.vehicleModel.findUnique.mockResolvedValue(MODEL_HILUX);
    prisma.vehicleVariant.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("toyota", "hilux", "nope");
    expect(result).toBeNull();
  });
});

// ── Search ─────────────────────────────────────────

describe("search", () => {
  it("searches across makes, models, and variants", async () => {
    prisma.vehicleMake.findMany.mockResolvedValue([MAKE_TOYOTA]);
    prisma.vehicleModel.findMany.mockResolvedValue([
      { ...MODEL_HILUX, make: MAKE_TOYOTA },
    ]);
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    const result = await service.search("toy");
    expect(result.makes).toHaveLength(1);
    expect(result.models).toHaveLength(1);
    expect(result.variants).toHaveLength(0);
  });

  it("uses case-insensitive contains", async () => {
    prisma.vehicleMake.findMany.mockResolvedValue([]);
    prisma.vehicleModel.findMany.mockResolvedValue([]);
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.search("TOYOTA");
    expect(prisma.vehicleMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "TOYOTA", mode: "insensitive" } },
      })
    );
  });

  it("respects limit parameter", async () => {
    prisma.vehicleMake.findMany.mockResolvedValue([]);
    prisma.vehicleModel.findMany.mockResolvedValue([]);
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.search("x", 5);
    expect(prisma.vehicleMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

// ── Filtered listing ───────────────────────────────

describe("listVariantsFiltered", () => {
  it("filters by market", async () => {
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ market: "AU" });
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ market: "AU" }),
      })
    );
  });

  it("filters by fuelType", async () => {
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ fuelType: "DIESEL" });
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fuelType: "DIESEL" }),
      })
    );
  });

  it("filters by bodyType through model relation", async () => {
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ bodyType: "SUV" });
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          model: { bodyType: "SUV" },
        }),
      })
    );
  });

  it("filters by year using range logic", async () => {
    prisma.vehicleVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ year: 2023 });
    expect(prisma.vehicleVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          yearFrom: { lte: 2023 },
          OR: [{ yearTo: { gte: 2023 } }, { isCurrentProduction: true }],
        }),
      })
    );
  });

  it("paginates filtered results", async () => {
    const items = [
      { ...makeVariant({ id: "a" }), model: { ...MODEL_HILUX, make: MAKE_TOYOTA } },
      { ...makeVariant({ id: "b" }), model: { ...MODEL_HILUX, make: MAKE_TOYOTA } },
      { ...makeVariant({ id: "c" }), model: { ...MODEL_HILUX, make: MAKE_TOYOTA } },
    ];
    prisma.vehicleVariant.findMany.mockResolvedValue(items);
    const result = await service.listVariantsFiltered({ market: "AU" }, { limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("b");
  });
});
