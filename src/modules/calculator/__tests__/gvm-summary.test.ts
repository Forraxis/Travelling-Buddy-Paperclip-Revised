import { describe, expect, it } from "vitest";
import { calculateGvmSummary, sumAccessoriesMass } from "../gvm-summary";
import type { GvmSummaryInputs } from "../gvm-summary";

const BASE: GvmSummaryInputs = {
  kerbWeightKg: 2500,
  gvmRatingKg: 3500,
  fuelTankCapacityL: 80,
  fuelType: "DIESEL",
  fuelPercent: 100,
  freshWaterCapacityL: 0,
  freshWaterPercent: 0,
  greyWaterCapacityL: 0,
  greyWaterPercent: 0,
  passengers: 2,
  passengerWeightKg: 80,
  cargoKg: 0,
  accessoriesMassKg: 0,
  towBallLoadKg: 0,
};

describe("calculateGvmSummary", () => {
  it("returns correct totals for base inputs", () => {
    // kerb 2500 + fuel 80*0.84=67.2 + passengers 2*80=160
    const result = calculateGvmSummary(BASE);
    expect(result.fuelMassKg).toBeCloseTo(67.2);
    expect(result.passengerMassKg).toBe(160);
    expect(result.totalGvmKg).toBeCloseTo(2727.2);
    expect(result.payloadRemainingKg).toBeCloseTo(772.8);
  });

  it("treats zero/missing fuel as 0 fuel mass", () => {
    const result = calculateGvmSummary({ ...BASE, fuelPercent: 0 });
    expect(result.fuelMassKg).toBe(0);
  });

  it("treats zero passengers as 0 passenger mass", () => {
    const result = calculateGvmSummary({ ...BASE, passengers: 0 });
    expect(result.passengerMassKg).toBe(0);
  });

  it("diesel density is 0.84 kg/L", () => {
    const result = calculateGvmSummary({ ...BASE, fuelType: "DIESEL", fuelPercent: 50, fuelTankCapacityL: 100 });
    expect(result.fuelMassKg).toBeCloseTo(42);
  });

  it("petrol density is 0.73 kg/L", () => {
    const result = calculateGvmSummary({ ...BASE, fuelType: "PETROL", fuelPercent: 100, fuelTankCapacityL: 100 });
    expect(result.fuelMassKg).toBeCloseTo(73);
  });

  it("hybrid density is 0.73 kg/L", () => {
    const result = calculateGvmSummary({ ...BASE, fuelType: "HYBRID", fuelPercent: 100, fuelTankCapacityL: 100 });
    expect(result.fuelMassKg).toBeCloseTo(73);
  });

  it("electric has zero fuel mass", () => {
    const result = calculateGvmSummary({ ...BASE, fuelType: "ELECTRIC", fuelPercent: 100, fuelTankCapacityL: 0 });
    expect(result.fuelMassKg).toBe(0);
  });

  it("water mass is 1 L = 1 kg", () => {
    const result = calculateGvmSummary({
      ...BASE,
      freshWaterCapacityL: 100,
      freshWaterPercent: 75,
      greyWaterCapacityL: 60,
      greyWaterPercent: 50,
    });
    expect(result.freshWaterMassKg).toBeCloseTo(75);
    expect(result.greyWaterMassKg).toBeCloseTo(30);
  });

  it("water at 0% capacity produces 0 mass", () => {
    const result = calculateGvmSummary({
      ...BASE,
      freshWaterCapacityL: 100,
      freshWaterPercent: 0,
    });
    expect(result.freshWaterMassKg).toBe(0);
  });

  it("accessories mass added to total", () => {
    const without = calculateGvmSummary(BASE);
    const with_ = calculateGvmSummary({ ...BASE, accessoriesMassKg: 150 });
    expect(with_.totalGvmKg - without.totalGvmKg).toBeCloseTo(150);
  });

  it("tow ball load contributes to total GVM", () => {
    const without = calculateGvmSummary(BASE);
    const with_ = calculateGvmSummary({ ...BASE, towBallLoadKg: 200 });
    expect(with_.towBallLoadKg).toBe(200);
    expect(with_.totalGvmKg - without.totalGvmKg).toBeCloseTo(200);
  });

  it("payload remaining can be negative when overloaded", () => {
    const result = calculateGvmSummary({ ...BASE, cargoKg: 2000 });
    expect(result.payloadRemainingKg).toBeLessThan(0);
  });

  it("surfaced tow ball load equals input value", () => {
    const result = calculateGvmSummary({ ...BASE, towBallLoadKg: 350 });
    expect(result.towBallLoadKg).toBe(350);
  });

  it("cargo included in total", () => {
    const result = calculateGvmSummary({ ...BASE, cargoKg: 400 });
    expect(result.cargoKg).toBe(400);
    expect(result.totalGvmKg).toBeCloseTo(2727.2 + 400);
  });

  it("gvmRatingKg passed through unchanged", () => {
    const result = calculateGvmSummary({ ...BASE, gvmRatingKg: 4200 });
    expect(result.gvmRatingKg).toBe(4200);
  });

  it("clamps negative cargo/accessories/towBall to 0", () => {
    const result = calculateGvmSummary({
      ...BASE,
      cargoKg: -100,
      accessoriesMassKg: -50,
      towBallLoadKg: -10,
    });
    expect(result.cargoKg).toBe(0);
    expect(result.accessoriesMassKg).toBe(0);
    expect(result.towBallLoadKg).toBe(0);
  });
});

describe("sumAccessoriesMass", () => {
  it("sums massKg values", () => {
    expect(sumAccessoriesMass([{ massKg: 10 }, { massKg: 20 }, { massKg: 30 }])).toBe(60);
  });

  it("returns 0 for empty list", () => {
    expect(sumAccessoriesMass([])).toBe(0);
  });

  it("treats missing/undefined massKg as 0", () => {
    expect(sumAccessoriesMass([{ massKg: undefined as unknown as number }])).toBe(0);
  });

  it("works with AccessorySelection objects", () => {
    const accessories = [
      { accessoryId: "a1", massKg: 45, mountingLocation: "ROOF_RACK" },
      { accessoryId: "a2", massKg: 12, mountingLocation: "BULL_BAR" },
    ];
    expect(sumAccessoriesMass(accessories)).toBe(57);
  });
});
