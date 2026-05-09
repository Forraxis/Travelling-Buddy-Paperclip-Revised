import { describe, it, expect } from "vitest";
import { accessoryPublicFilterSchema, mountingLocationsQuerySchema } from "../validation/schemas";

describe("accessoryPublicFilterSchema", () => {
  it("accepts empty params", () => {
    const result = accessoryPublicFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts brand and category slugs", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      brand: "arb",
      category: "bullbars",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ brand: "arb", category: "bullbars" });
  });

  it("accepts vehicleVariantId filter", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      vehicleVariantId: "variant-uuid",
    });
    expect(result.success).toBe(true);
    expect(result.data!.vehicleVariantId).toBe("variant-uuid");
  });

  it("accepts caravanVariantId filter", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      caravanVariantId: "caravan-variant-uuid",
    });
    expect(result.success).toBe(true);
    expect(result.data!.caravanVariantId).toBe("caravan-variant-uuid");
  });

  it("accepts text search query", () => {
    const result = accessoryPublicFilterSchema.safeParse({ q: "bullbar" });
    expect(result.success).toBe(true);
    expect(result.data!.q).toBe("bullbar");
  });

  it("accepts pagination params", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      cursor: "some-cursor-id",
      limit: "10",
    });
    expect(result.success).toBe(true);
    expect(result.data!.limit).toBe(10);
    expect(result.data!.cursor).toBe("some-cursor-id");
  });

  it("accepts combined filters", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      brand: "arb",
      category: "lighting",
      vehicleVariantId: "v1",
      limit: "24",
    });
    expect(result.success).toBe(true);
  });

  it("rejects brand slug longer than 120 chars", () => {
    const result = accessoryPublicFilterSchema.safeParse({
      brand: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects search query longer than 200 chars", () => {
    const result = accessoryPublicFilterSchema.safeParse({ q: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 100", () => {
    const result = accessoryPublicFilterSchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });
});

describe("mountingLocationsQuerySchema", () => {
  it("accepts vehicleVariantId alone", () => {
    const result = mountingLocationsQuerySchema.safeParse({
      vehicleVariantId: "v1",
    });
    expect(result.success).toBe(true);
    expect(result.data!.vehicleVariantId).toBe("v1");
    expect(result.data!.fittedFitmentIds).toBeUndefined();
  });

  it("accepts vehicleVariantId with fittedFitmentIds", () => {
    const result = mountingLocationsQuerySchema.safeParse({
      vehicleVariantId: "v1",
      fittedFitmentIds: "f1,f2,f3",
    });
    expect(result.success).toBe(true);
    expect(result.data!.fittedFitmentIds).toBe("f1,f2,f3");
  });

  it("rejects missing vehicleVariantId", () => {
    const result = mountingLocationsQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
