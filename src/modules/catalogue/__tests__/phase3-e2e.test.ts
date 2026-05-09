/**
 * Phase 3 E2E verification tests
 *
 * These tests verify the complete Phase 3 flows through the service layer using
 * mocked Prisma (same pattern as other service tests in this directory).
 * They cover three scenarios specified in TRAAAA-43:
 *   1. Admin CRUD flow: brand → category → accessory → fitment → public list
 *   2. CSV upload → accessory in admin list + public API
 *   3. Mounting location resolution with a bullbar seed fitment
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBrandService } from "../services/brand.service";
import { createCategoryService } from "../services/category.service";
import { createAccessoryService } from "../services/accessory.service";
import { createFitmentService } from "../services/fitment.service";
import { validateAndPreviewAccessoryCsv } from "../csv/accessory-csv";

// ── Shared mock helpers ────────────────────────────

function makeModel() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  };
}

function makeDecimal(n: number) {
  return { toNumber: () => n };
}

const now = new Date("2026-01-01T00:00:00Z");

// ── E2E 1: Admin CRUD flow ─────────────────────────
//
// Simulates the full admin path:
//   createBrand → createCategory → createAccessory → createFitment
//   → accessory visible via service.list({ vehicleVariantId })

describe("E2E: Admin create brand → category → accessory → fitment → public browse", () => {
  const BRAND = {
    id: "brand-arb",
    name: "ARB",
    slug: "arb",
    description: "Australian off-road brand",
    logoUrl: null,
    websiteUrl: null,
    market: "AU" as const,
    status: "ACTIVE" as const,
    createdAt: now,
    updatedAt: now,
  };

  const CATEGORY = {
    id: "cat-bullbar",
    name: "Bullbar",
    slug: "bullbar",
    description: "Front bull bars",
    parentId: null,
    displayOrder: 1,
    iconName: "shield",
    createdAt: now,
    updatedAt: now,
  };

  const ACCESSORY = {
    id: "acc-summit",
    brandId: "brand-arb",
    categoryId: "cat-bullbar",
    name: "ARB Summit Bullbar",
    slug: "summit-bullbar",
    description: "Heavy duty steel bullbar",
    imageUrls: [],
    priceMin: makeDecimal(1899),
    priceMax: makeDecimal(2299),
    currencyCode: "AUD",
    affiliateUrl: null,
    status: "ACTIVE" as const,
    market: "AU" as const,
    createdAt: now,
    updatedAt: now,
  };

  const FITMENT = {
    id: "fit-bullbar-hilux",
    accessoryId: "acc-summit",
    vehicleVariantId: "vv-hilux-sr5",
    caravanVariantId: null,
    installedWeightKg: makeDecimal(42),
    positionType: "FIXED",
    cogXMm: 3600,
    cogYMm: 0,
    startXMm: null,
    endXMm: null,
    mountingLocation: "CHASSIS_FRONT",
    providesMountingLocations: ["BULL_BAR"],
    mountOffsetXMm: 3600,
    mountOffsetYMm: 0,
    mountOffsetZMm: 0,
    tankCapacityL: null,
    tankContentsKgPerL: null,
    confidence: "MANUFACTURER_SPEC",
    source: "AFTERMARKET_VERIFIED",
    notes: null,
    verifiedById: null,
    createdAt: now,
    updatedAt: now,
  };

  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  function buildMockPrisma() {
    return {
      accessoryBrand: makeModel(),
      accessoryCategory: makeModel(),
      accessory: makeModel(),
      accessoryFitment: makeModel(),
    };
  }

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
  });

  it("creates brand, category, accessory and fitment in sequence", async () => {
    mockPrisma.accessoryBrand.create.mockResolvedValue(BRAND);
    mockPrisma.accessoryCategory.create.mockResolvedValue(CATEGORY);
    mockPrisma.accessory.create.mockResolvedValue(ACCESSORY);
    mockPrisma.accessoryFitment.create.mockResolvedValue(FITMENT);

    const brandService = createBrandService(mockPrisma as never);
    const categoryService = createCategoryService(mockPrisma as never);
    const accessoryService = createAccessoryService(mockPrisma as never);
    const fitmentService = createFitmentService(mockPrisma as never);

    const brand = await brandService.create({ name: "ARB", slug: "arb" });
    expect(brand.id).toBe("brand-arb");

    const category = await categoryService.create({ name: "Bullbar", slug: "bullbar", displayOrder: 1 });
    expect(category.id).toBe("cat-bullbar");

    const accessory = await accessoryService.create({
      brandId: brand.id,
      categoryId: category.id,
      name: "ARB Summit Bullbar",
      slug: "summit-bullbar",
    });
    expect(accessory.id).toBe("acc-summit");
    expect(accessory.priceMin).toBe(1899);
    expect(accessory.priceMax).toBe(2299);

    const fitment = await fitmentService.create({
      accessoryId: accessory.id,
      vehicleVariantId: "vv-hilux-sr5",
      installedWeightKg: 42,
      positionType: "FIXED",
      mountingLocation: "CHASSIS_FRONT",
    });
    expect(fitment.id).toBe("fit-bullbar-hilux");
    expect(fitment.installedWeightKg).toBe(42);
    expect(fitment.providesMountingLocations).toContain("BULL_BAR");
  });

  it("accessory is visible via public list filtered by vehicleVariantId", async () => {
    // Public browse: list({ vehicleVariantId: "vv-hilux-sr5" }) should return the accessory
    mockPrisma.accessory.findMany.mockResolvedValue([ACCESSORY]);

    const accessoryService = createAccessoryService(mockPrisma as never);
    const result = await accessoryService.list({ vehicleVariantId: "vv-hilux-sr5", status: "ACTIVE" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("acc-summit");
    expect(mockPrisma.accessory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fitments: { some: { vehicleVariantId: "vv-hilux-sr5" } },
          status: "ACTIVE",
        }),
      })
    );
  });

  it("fitments are retrievable for the accessory after creation", async () => {
    mockPrisma.accessoryFitment.findMany.mockResolvedValue([FITMENT]);

    const fitmentService = createFitmentService(mockPrisma as never);
    const fitments = await fitmentService.getFitmentsForAccessory("acc-summit");

    expect(fitments).toHaveLength(1);
    expect(fitments[0].mountingLocation).toBe("CHASSIS_FRONT");
    expect(fitments[0].providesMountingLocations).toContain("BULL_BAR");
  });

  it("accessory is visible via public list filtered by brand slug", async () => {
    mockPrisma.accessory.findMany.mockResolvedValue([ACCESSORY]);

    const accessoryService = createAccessoryService(mockPrisma as never);
    // Simulates the API route resolving brand slug → id, then calling list
    const result = await accessoryService.list({ brandId: "brand-arb", status: "ACTIVE" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe("summit-bullbar");
  });
});

// ── E2E 2: CSV upload flow ─────────────────────────
//
// Simulates: upload CSV → parse/validate → deduplicate → import
// Verifies accessory appears in admin list and public API queries.

describe("E2E: CSV upload → accessory in admin list and public API", () => {
  const VALID_CSV = [
    "brand_name,category_name,name,slug,description,status",
    "ARB,Bullbar,ARB Summit Bullbar – Toyota HiLux,summit-bullbar-hilux,Heavy-duty steel bull bar,ACTIVE",
    "ARB,Winch,ARB Warn Winch 9500,warn-winch-9500,9500lb electric winch,ACTIVE",
    "TJM,Bullbar,TJM Outback Bar,tjm-outback-bar,,ACTIVE",
  ].join("\n");

  it("parses valid CSV and returns correct preview counts", () => {
    const preview = validateAndPreviewAccessoryCsv(VALID_CSV);

    expect(preview.totalInputRows).toBe(3);
    expect(preview.validRows).toBe(3);
    expect(preview.errorRows).toBe(0);
    expect(preview.duplicateRows).toBe(0);
    expect(preview.deduplicated).toHaveLength(3);
  });

  it("parsed rows have correct brandName, categoryName, name and slug", () => {
    const preview = validateAndPreviewAccessoryCsv(VALID_CSV);
    const row = preview.deduplicated[0];

    expect(row.brandName).toBe("ARB");
    expect(row.categoryName).toBe("Bullbar");
    expect(row.name).toBe("ARB Summit Bullbar – Toyota HiLux");
    expect(row.slug).toBe("summit-bullbar-hilux");
    expect(row.status).toBe("ACTIVE");
  });

  it("deduplicates duplicate brand+slug rows", () => {
    const csvWithDuplicate = [
      "brand_name,category_name,name,slug,description,status",
      "ARB,Bullbar,ARB Summit Bullbar,arb-summit-bullbar,,ACTIVE",
      "ARB,Bullbar,ARB Summit Bullbar,arb-summit-bullbar,,ACTIVE",
    ].join("\n");

    const preview = validateAndPreviewAccessoryCsv(csvWithDuplicate);

    expect(preview.totalInputRows).toBe(2);
    expect(preview.validRows).toBe(2);
    expect(preview.duplicateRows).toBe(1);
    expect(preview.deduplicated).toHaveLength(1);
  });

  it("reports validation errors for missing required fields", () => {
    const badCsv = [
      "brand_name,category_name,name,slug,description,status",
      ",Bullbar,Missing Brand,,desc,ACTIVE",
    ].join("\n");

    const preview = validateAndPreviewAccessoryCsv(badCsv);

    expect(preview.errorRows).toBe(1);
    expect(preview.validRows).toBe(0);
    expect(preview.deduplicated).toHaveLength(0);
  });

  it("rejects invalid status values", () => {
    const badStatus = [
      "brand_name,category_name,name,slug,description,status",
      "ARB,Bullbar,Some Bar,some-bar,,INVALID_STATUS",
    ].join("\n");

    const preview = validateAndPreviewAccessoryCsv(badStatus);
    expect(preview.errorRows).toBe(1);
  });

  it("auto-derives slug from name when slug column is empty", () => {
    const noSlugCsv = [
      "brand_name,category_name,name,slug,description,status",
      "ARB,Bullbar,ARB Summit Bullbar,,desc,ACTIVE",
    ].join("\n");

    const preview = validateAndPreviewAccessoryCsv(noSlugCsv);
    expect(preview.deduplicated[0].slug).toBe("arb-summit-bullbar");
  });

  it("imported accessories are queryable via accessory service list", async () => {
    // After commit, simulate the accessory being in the database and queryable
    const mockPrisma = { accessory: makeModel() };
    const importedAccessory = {
      id: "acc-imported",
      brandId: "brand-arb",
      categoryId: "cat-bullbar",
      name: "ARB Summit Bullbar – Toyota HiLux",
      slug: "summit-bullbar-hilux",
      description: "Heavy-duty steel bull bar",
      imageUrls: [],
      priceMin: null,
      priceMax: null,
      currencyCode: "AUD",
      affiliateUrl: null,
      status: "ACTIVE" as const,
      market: "AU" as const,
      createdAt: now,
      updatedAt: now,
    };

    mockPrisma.accessory.findMany.mockResolvedValue([importedAccessory]);

    const accessoryService = createAccessoryService(mockPrisma as never);

    // Admin list (no status filter)
    const adminResult = await accessoryService.list({ brandId: "brand-arb" });
    expect(adminResult.items).toHaveLength(1);
    expect(adminResult.items[0].slug).toBe("summit-bullbar-hilux");

    // Public API (with ACTIVE status filter)
    const publicResult = await accessoryService.list({ status: "ACTIVE" });
    expect(publicResult.items).toHaveLength(1);
    expect(publicResult.items[0].name).toBe("ARB Summit Bullbar – Toyota HiLux");
  });
});

// ── E2E 3: Mounting location resolution ───────────
//
// Verifies getAvailableMountingLocations returns correct locations
// after fitting a bullbar seed fitment (CHASSIS_FRONT → provides BULL_BAR).

describe("E2E: Mounting location resolution — bullbar seed fitment", () => {
  const mockPrisma = { accessoryFitment: makeModel() };

  beforeEach(() => {
    mockPrisma.accessoryFitment.findMany.mockReset();
  });

  it("bare vehicle has CHASSIS_FRONT but no BULL_BAR", async () => {
    const service = createFitmentService(mockPrisma as never);
    const locations = await service.getAvailableMountingLocations("vv-hilux-sr5", []);

    expect(locations).toContain("CHASSIS_FRONT");
    expect(locations).not.toContain("BULL_BAR");
  });

  it("after fitting bullbar: BULL_BAR available, CHASSIS_FRONT occupied", async () => {
    // Seed fitment shape from prisma/seed.ts — bullbar on CHASSIS_FRONT providing BULL_BAR
    mockPrisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: "CHASSIS_FRONT",
        providesMountingLocations: ["BULL_BAR"],
      },
    ]);

    const service = createFitmentService(mockPrisma as never);
    const locations = await service.getAvailableMountingLocations("vv-hilux-sr5", [
      "fit-bullbar-hilux",
    ]);

    expect(locations).toContain("BULL_BAR");
    expect(locations).not.toContain("CHASSIS_FRONT");
  });

  it("after fitting bullbar + winch: both BULL_BAR and CHASSIS_FRONT occupied", async () => {
    mockPrisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: "CHASSIS_FRONT",
        providesMountingLocations: ["BULL_BAR"],
      },
      {
        mountingLocation: "BULL_BAR",
        providesMountingLocations: [],
      },
    ]);

    const service = createFitmentService(mockPrisma as never);
    const locations = await service.getAvailableMountingLocations("vv-hilux-sr5", [
      "fit-bullbar-hilux",
      "fit-winch",
    ]);

    expect(locations).not.toContain("BULL_BAR");
    expect(locations).not.toContain("CHASSIS_FRONT");
    // Other base locations are still available
    expect(locations).toContain("CHASSIS_MID");
    expect(locations).toContain("REAR_BAR");
    expect(locations).toContain("TOW_HITCH");
  });

  it("multiple accessories each occupy a different location", async () => {
    // Bullbar on CHASSIS_FRONT + roof rack on ROOF_RAILS each providing new locations
    mockPrisma.accessoryFitment.findMany.mockResolvedValue([
      {
        mountingLocation: "CHASSIS_FRONT",
        providesMountingLocations: ["BULL_BAR"],
      },
      {
        mountingLocation: "ROOF_RAILS",
        providesMountingLocations: ["ROOF_RACK", "CANOPY_ROOF"],
      },
    ]);

    const service = createFitmentService(mockPrisma as never);
    const locations = await service.getAvailableMountingLocations("vv-hilux-sr5", [
      "fit-bullbar-hilux",
      "fit-roof-rack",
    ]);

    expect(locations).toContain("BULL_BAR");
    expect(locations).toContain("ROOF_RACK");
    expect(locations).toContain("CANOPY_ROOF");
    expect(locations).not.toContain("CHASSIS_FRONT");
    expect(locations).not.toContain("ROOF_RAILS");
  });

  it("mounting location query correctly routes to fitment service via fitment ids", async () => {
    // Reproduces the exact query the API route performs:
    //   fittedFitmentIds="fit-1,fit-2" → split → getAvailableMountingLocations(variantId, [ids])
    const fitmentIds = "fit-bullbar-hilux,fit-roof-rack";
    const parsed = fitmentIds.split(",").map((s) => s.trim()).filter(Boolean);

    expect(parsed).toHaveLength(2);
    expect(parsed).toContain("fit-bullbar-hilux");
    expect(parsed).toContain("fit-roof-rack");

    mockPrisma.accessoryFitment.findMany.mockResolvedValue([
      { mountingLocation: "CHASSIS_FRONT", providesMountingLocations: ["BULL_BAR"] },
      { mountingLocation: "ROOF_RAILS", providesMountingLocations: ["ROOF_RACK"] },
    ]);

    const service = createFitmentService(mockPrisma as never);
    const locations = await service.getAvailableMountingLocations("vv-hilux-sr5", parsed);

    expect(locations).toContain("BULL_BAR");
    expect(locations).toContain("ROOF_RACK");
    expect(mockPrisma.accessoryFitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["fit-bullbar-hilux", "fit-roof-rack"] },
        }),
      })
    );
  });
});
