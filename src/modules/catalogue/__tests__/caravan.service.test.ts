import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCaravanService } from "../services/caravan.service";
import type { CaravanService } from "../services/caravan.service";

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
    caravanMake: makePrismaModel(),
    caravanModel: makePrismaModel(),
    caravanVariant: makePrismaModel(),
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const now = new Date("2026-01-01T00:00:00Z");

const MAKE_JAYCO = {
  id: "make-1",
  name: "Jayco",
  slug: "jayco",
  logoUrl: null,
  countryOfOrigin: "Australia",
  createdAt: now,
  updatedAt: now,
};

const MODEL_JOURNEY = {
  id: "model-1",
  makeId: "make-1",
  name: "Journey",
  slug: "journey",
  bodyType: "CARAVAN_FULL_HEIGHT" as const,
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
    name: "Journey Outback 17.58-3",
    slug: "journey-outback-17-58-3-2021-2024",
    atmKg: 2700,
    gtmKg: 2500,
    tareKg: 2100,
    tbmKg: 200,
    axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED" as const,
    couplingToAxleMm: 4500,
    axleSpacingMm: 900,
    bodyLengthMm: 5400,
    overallLengthMm: 7200,
    freshWaterCapacityL: 150,
    greyWaterCapacityL: 100,
    gasBottleConfig: "2x9kg",
    market: "AU" as const,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let prisma: MockPrisma;
let service: CaravanService;

beforeEach(() => {
  prisma = createMockPrisma();
  service = createCaravanService(prisma as never);
});

// ── Makes ──────────────────────────────────────────

describe("Makes CRUD", () => {
  it("createMake calls prisma.caravanMake.create", async () => {
    prisma.caravanMake.create.mockResolvedValue(MAKE_JAYCO);
    const result = await service.createMake({
      name: "Jayco",
      slug: "jayco",
    });
    expect(result).toEqual(MAKE_JAYCO);
    expect(prisma.caravanMake.create).toHaveBeenCalledWith({
      data: { name: "Jayco", slug: "jayco" },
    });
  });

  it("updateMake calls prisma.caravanMake.update", async () => {
    const updated = { ...MAKE_JAYCO, name: "JAYCO" };
    prisma.caravanMake.update.mockResolvedValue(updated);
    const result = await service.updateMake("make-1", { name: "JAYCO" });
    expect(result.name).toBe("JAYCO");
  });

  it("deleteMake calls prisma.caravanMake.delete", async () => {
    prisma.caravanMake.delete.mockResolvedValue(MAKE_JAYCO);
    await service.deleteMake("make-1");
    expect(prisma.caravanMake.delete).toHaveBeenCalledWith({
      where: { id: "make-1" },
    });
  });

  it("getMakeById returns make with models", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue({
      ...MAKE_JAYCO,
      models: [MODEL_JOURNEY],
    });
    const result = await service.getMakeById("make-1");
    expect(result?.models).toHaveLength(1);
  });

  it("getMakeBySlug returns make with models", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue({
      ...MAKE_JAYCO,
      models: [],
    });
    const result = await service.getMakeBySlug("jayco");
    expect(result?.slug).toBe("jayco");
  });

  it("getMakeById returns null for non-existent make", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(null);
    const result = await service.getMakeById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("Makes pagination", () => {
  it("listMakes returns paginated result with cursor", async () => {
    const makes = [
      { ...MAKE_JAYCO, id: "a" },
      { ...MAKE_JAYCO, id: "b" },
      { ...MAKE_JAYCO, id: "c" },
    ];
    prisma.caravanMake.findMany.mockResolvedValue(makes);
    const result = await service.listMakes({ limit: 2 });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("b");
  });

  it("listMakes returns no cursor when no more items", async () => {
    prisma.caravanMake.findMany.mockResolvedValue([MAKE_JAYCO]);
    const result = await service.listMakes({ limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("listMakes uses cursor when provided", async () => {
    prisma.caravanMake.findMany.mockResolvedValue([]);
    await service.listMakes({ cursor: "abc", limit: 10 });
    expect(prisma.caravanMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: "abc" },
      })
    );
  });
});

// ── Models ─────────────────────────────────────────

describe("Models CRUD", () => {
  it("createModel calls prisma.caravanModel.create", async () => {
    prisma.caravanModel.create.mockResolvedValue(MODEL_JOURNEY);
    const result = await service.createModel({
      makeId: "make-1",
      name: "Journey",
      slug: "journey",
      bodyType: "CARAVAN_FULL_HEIGHT",
    });
    expect(result).toEqual(MODEL_JOURNEY);
  });

  it("updateModel calls prisma.caravanModel.update", async () => {
    prisma.caravanModel.update.mockResolvedValue({
      ...MODEL_JOURNEY,
      name: "Journey Outback",
    });
    const result = await service.updateModel("model-1", {
      name: "Journey Outback",
    });
    expect(result.name).toBe("Journey Outback");
  });

  it("deleteModel calls prisma.caravanModel.delete", async () => {
    prisma.caravanModel.delete.mockResolvedValue(MODEL_JOURNEY);
    await service.deleteModel("model-1");
    expect(prisma.caravanModel.delete).toHaveBeenCalledWith({
      where: { id: "model-1" },
    });
  });

  it("getModelById returns model with variants", async () => {
    prisma.caravanModel.findUnique.mockResolvedValue({
      ...MODEL_JOURNEY,
      variants: [makeVariant()],
    });
    const result = await service.getModelById("model-1");
    expect(result?.variants).toHaveLength(1);
  });

  it("getModelBySlug resolves make first then finds model", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(MAKE_JAYCO);
    prisma.caravanModel.findUnique.mockResolvedValue({
      ...MODEL_JOURNEY,
      variants: [],
      make: MAKE_JAYCO,
    });
    const result = await service.getModelBySlug("jayco", "journey");
    expect(result?.slug).toBe("journey");
    expect(prisma.caravanModel.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { makeId_slug: { makeId: "make-1", slug: "journey" } },
      })
    );
  });

  it("getModelBySlug returns null if make not found", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(null);
    const result = await service.getModelBySlug("nope", "journey");
    expect(result).toBeNull();
  });
});

describe("Models pagination", () => {
  it("listModelsByMake filters by makeId", async () => {
    prisma.caravanModel.findMany.mockResolvedValue([MODEL_JOURNEY]);
    await service.listModelsByMake("make-1");
    expect(prisma.caravanModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { makeId: "make-1" } })
    );
  });
});

// ── Variants ───────────────────────────────────────

describe("Variants CRUD", () => {
  it("createVariant calls prisma.caravanVariant.create", async () => {
    const v = makeVariant();
    prisma.caravanVariant.create.mockResolvedValue(v);
    const result = await service.createVariant({
      modelId: "model-1",
      yearFrom: 2021,
      yearTo: 2024,
      name: "Journey Outback 17.58-3",
      slug: "journey-outback-17-58-3-2021-2024",
      atmKg: 2700,
      gtmKg: 2500,
      tareKg: 2100,
      tbmKg: 200,
      axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
      couplingToAxleMm: 4500,
      axleSpacingMm: 900,
      bodyLengthMm: 5400,
      overallLengthMm: 7200,
      freshWaterCapacityL: 150,
      greyWaterCapacityL: 100,
      gasBottleConfig: "2x9kg",
    });
    expect(result.id).toBe("variant-1");
  });

  it("createVariant with single-axle (axleSpacingMm null)", async () => {
    const v = makeVariant({
      axleConfiguration: "SINGLE_AXLE",
      axleSpacingMm: null,
    });
    prisma.caravanVariant.create.mockResolvedValue(v);
    const result = await service.createVariant({
      modelId: "model-1",
      yearFrom: 2021,
      yearTo: 2024,
      name: "Journey Outback 17.58-3",
      slug: "journey-outback-17-58-3-2021-2024",
      atmKg: 2700,
      gtmKg: 2500,
      tareKg: 2100,
      tbmKg: 200,
      axleConfiguration: "SINGLE_AXLE",
      couplingToAxleMm: 4500,
      axleSpacingMm: null,
      bodyLengthMm: 5400,
      overallLengthMm: 7200,
      freshWaterCapacityL: 150,
      greyWaterCapacityL: 100,
    });
    expect(result.axleConfiguration).toBe("SINGLE_AXLE");
    expect(result.axleSpacingMm).toBeNull();
  });

  it("updateVariant calls prisma.caravanVariant.update", async () => {
    prisma.caravanVariant.update.mockResolvedValue(
      makeVariant({ yearTo: 2025 })
    );
    const result = await service.updateVariant("variant-1", { yearTo: 2025 });
    expect(result.yearTo).toBe(2025);
  });

  it("deleteVariant calls prisma.caravanVariant.delete", async () => {
    prisma.caravanVariant.delete.mockResolvedValue(makeVariant());
    await service.deleteVariant("variant-1");
    expect(prisma.caravanVariant.delete).toHaveBeenCalledWith({
      where: { id: "variant-1" },
    });
  });

  it("getVariantById includes model and make", async () => {
    prisma.caravanVariant.findUnique.mockResolvedValue({
      ...makeVariant(),
      model: { ...MODEL_JOURNEY, make: MAKE_JAYCO },
    });
    const result = await service.getVariantById("variant-1");
    expect(result?.model.make.name).toBe("Jayco");
  });
});

// ── Year-range queries ─────────────────────────────

describe("findVariantByYear", () => {
  it("finds variant covering the given year", async () => {
    const v = makeVariant({ yearFrom: 2021, yearTo: 2024 });
    prisma.caravanVariant.findMany.mockResolvedValue([v]);
    const result = await service.findVariantByYear("model-1", 2022);
    expect(result).toHaveLength(1);
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith({
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
    prisma.caravanVariant.findMany.mockResolvedValue([currentProd]);
    const result = await service.findVariantByYear("model-1", 2026);
    expect(result).toHaveLength(1);
  });

  it("returns empty for year before any variant", async () => {
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    const result = await service.findVariantByYear("model-1", 2000);
    expect(result).toHaveLength(0);
  });

  it("handles single-year variant (yearFrom === yearTo)", async () => {
    const singleYear = makeVariant({
      yearFrom: 2023,
      yearTo: 2023,
    });
    prisma.caravanVariant.findMany.mockResolvedValue([singleYear]);
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
    prisma.caravanVariant.findMany.mockResolvedValue([v1, v2]);
    const result = await service.findVariantsInRange("model-1", 2020, 2023);
    expect(result).toHaveLength(2);
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith({
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
    prisma.caravanVariant.findMany.mockResolvedValue([v1, v2]);
    const result = await service.findVariantsInRange("model-1", 2021, 2021);
    expect(result).toHaveLength(2);
  });

  it("includes current-production variants in range queries", async () => {
    const cp = makeVariant({
      yearFrom: 2024,
      yearTo: 2024,
      isCurrentProduction: true,
    });
    prisma.caravanVariant.findMany.mockResolvedValue([cp]);
    const result = await service.findVariantsInRange("model-1", 2024, 2030);
    expect(result).toHaveLength(1);
  });
});

// ── Slug-based lookup ──────────────────────────────

describe("findBySlug", () => {
  it("resolves make → model → variant by slugs", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(MAKE_JAYCO);
    prisma.caravanModel.findUnique.mockResolvedValue(MODEL_JOURNEY);
    prisma.caravanVariant.findUnique.mockResolvedValue({
      ...makeVariant(),
      model: { ...MODEL_JOURNEY, make: MAKE_JAYCO },
    });
    const result = await service.findBySlug(
      "jayco",
      "journey",
      "journey-outback-17-58-3-2021-2024"
    );
    expect(result?.slug).toBe("journey-outback-17-58-3-2021-2024");
  });

  it("returns null if make slug not found", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("nope", "journey", "variant");
    expect(result).toBeNull();
  });

  it("returns null if model slug not found", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(MAKE_JAYCO);
    prisma.caravanModel.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("jayco", "nope", "variant");
    expect(result).toBeNull();
  });

  it("returns null if variant slug not found", async () => {
    prisma.caravanMake.findUnique.mockResolvedValue(MAKE_JAYCO);
    prisma.caravanModel.findUnique.mockResolvedValue(MODEL_JOURNEY);
    prisma.caravanVariant.findUnique.mockResolvedValue(null);
    const result = await service.findBySlug("jayco", "journey", "nope");
    expect(result).toBeNull();
  });
});

// ── Search ─────────────────────────────────────────

describe("search", () => {
  it("searches across makes, models, and variants", async () => {
    prisma.caravanMake.findMany.mockResolvedValue([MAKE_JAYCO]);
    prisma.caravanModel.findMany.mockResolvedValue([
      { ...MODEL_JOURNEY, make: MAKE_JAYCO },
    ]);
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    const result = await service.search("jay");
    expect(result.makes).toHaveLength(1);
    expect(result.models).toHaveLength(1);
    expect(result.variants).toHaveLength(0);
  });

  it("uses case-insensitive contains", async () => {
    prisma.caravanMake.findMany.mockResolvedValue([]);
    prisma.caravanModel.findMany.mockResolvedValue([]);
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.search("JAYCO");
    expect(prisma.caravanMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "JAYCO", mode: "insensitive" } },
      })
    );
  });

  it("respects limit parameter", async () => {
    prisma.caravanMake.findMany.mockResolvedValue([]);
    prisma.caravanModel.findMany.mockResolvedValue([]);
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.search("x", 5);
    expect(prisma.caravanMake.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

// ── Filtered listing ───────────────────────────────

describe("listVariantsFiltered", () => {
  it("filters by market", async () => {
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ market: "AU" });
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ market: "AU" }),
      })
    );
  });

  it("filters by axleConfiguration", async () => {
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({
      axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
    });
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          axleConfiguration: "DUAL_AXLE_CLOSE_COUPLED",
        }),
      })
    );
  });

  it("filters by bodyType through model relation", async () => {
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ bodyType: "OFF_ROAD_CARAVAN" });
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          model: { bodyType: "OFF_ROAD_CARAVAN" },
        }),
      })
    );
  });

  it("filters by year using range logic", async () => {
    prisma.caravanVariant.findMany.mockResolvedValue([]);
    await service.listVariantsFiltered({ year: 2023 });
    expect(prisma.caravanVariant.findMany).toHaveBeenCalledWith(
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
      {
        ...makeVariant({ id: "a" }),
        model: { ...MODEL_JOURNEY, make: MAKE_JAYCO },
      },
      {
        ...makeVariant({ id: "b" }),
        model: { ...MODEL_JOURNEY, make: MAKE_JAYCO },
      },
      {
        ...makeVariant({ id: "c" }),
        model: { ...MODEL_JOURNEY, make: MAKE_JAYCO },
      },
    ];
    prisma.caravanVariant.findMany.mockResolvedValue(items);
    const result = await service.listVariantsFiltered(
      { market: "AU" },
      { limit: 2 }
    );
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("b");
  });
});
