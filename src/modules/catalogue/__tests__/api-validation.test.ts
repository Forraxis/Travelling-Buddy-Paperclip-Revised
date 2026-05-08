import { describe, it, expect } from "vitest";
import {
  paginationSchema,
  searchSchema,
  vehicleFilterSchema,
  caravanFilterSchema,
} from "../validation/schemas";

describe("paginationSchema", () => {
  it("accepts empty params", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid cursor and limit", () => {
    const result = paginationSchema.safeParse({
      cursor: "some-id",
      limit: "10",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ cursor: "some-id", limit: 10 });
  });

  it("rejects limit > 100", () => {
    const result = paginationSchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit < 1", () => {
    const result = paginationSchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer limit", () => {
    const result = paginationSchema.safeParse({ limit: "1.5" });
    expect(result.success).toBe(false);
  });
});

describe("searchSchema", () => {
  it("accepts valid query", () => {
    const result = searchSchema.safeParse({ q: "toyota" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ q: "toyota" });
  });

  it("accepts query with limit", () => {
    const result = searchSchema.safeParse({ q: "hilux", limit: "5" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ q: "hilux", limit: 5 });
  });

  it("rejects empty query", () => {
    const result = searchSchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing query", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects limit > 50", () => {
    const result = searchSchema.safeParse({ q: "test", limit: "51" });
    expect(result.success).toBe(false);
  });
});

describe("vehicleFilterSchema", () => {
  it("accepts valid body type", () => {
    const result = vehicleFilterSchema.safeParse({ bodyType: "SUV" });
    expect(result.success).toBe(true);
  });

  it("accepts valid fuel type", () => {
    const result = vehicleFilterSchema.safeParse({ fuelType: "DIESEL" });
    expect(result.success).toBe(true);
  });

  it("accepts valid year", () => {
    const result = vehicleFilterSchema.safeParse({ year: "2024" });
    expect(result.success).toBe(true);
    expect(result.data!.year).toBe(2024);
  });

  it("accepts valid market", () => {
    const result = vehicleFilterSchema.safeParse({ market: "AU" });
    expect(result.success).toBe(true);
  });

  it("accepts combined filters with pagination", () => {
    const result = vehicleFilterSchema.safeParse({
      bodyType: "DUAL_CAB_UTE",
      fuelType: "DIESEL",
      year: "2023",
      market: "AU",
      limit: "10",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bodyType: "DUAL_CAB_UTE",
      fuelType: "DIESEL",
      year: 2023,
      market: "AU",
      limit: 10,
    });
  });

  it("rejects invalid body type", () => {
    const result = vehicleFilterSchema.safeParse({ bodyType: "SEDAN" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid fuel type", () => {
    const result = vehicleFilterSchema.safeParse({ fuelType: "HYDROGEN" });
    expect(result.success).toBe(false);
  });

  it("rejects year below 1900", () => {
    const result = vehicleFilterSchema.safeParse({ year: "1800" });
    expect(result.success).toBe(false);
  });
});

describe("caravanFilterSchema", () => {
  it("accepts valid body type", () => {
    const result = caravanFilterSchema.safeParse({
      bodyType: "OFF_ROAD_CARAVAN",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid axle configuration", () => {
    const result = caravanFilterSchema.safeParse({
      axleConfiguration: "DUAL_AXLE_SPREAD",
    });
    expect(result.success).toBe(true);
  });

  it("accepts combined filters", () => {
    const result = caravanFilterSchema.safeParse({
      bodyType: "CARAVAN_FULL_HEIGHT",
      axleConfiguration: "SINGLE_AXLE",
      year: "2024",
      market: "AU",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid body type", () => {
    const result = caravanFilterSchema.safeParse({ bodyType: "MOTORHOME" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid axle configuration", () => {
    const result = caravanFilterSchema.safeParse({
      axleConfiguration: "QUAD_AXLE",
    });
    expect(result.success).toBe(false);
  });
});
