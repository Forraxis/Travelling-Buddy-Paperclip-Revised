import { describe, expect, it } from "vitest";
import { calculatorReducer, INITIAL_STATE, DEFAULT_JOURNEY } from "../types";
import type { CalculatorState } from "../types";

describe("calculatorReducer", () => {
  it("returns initial state unchanged for unknown action", () => {
    // @ts-expect-error — testing unknown action
    expect(calculatorReducer(INITIAL_STATE, { type: "UNKNOWN" })).toBe(INITIAL_STATE);
  });

  it("SET_VEHICLE_VARIANT sets vehicleVariantId", () => {
    const next = calculatorReducer(INITIAL_STATE, { type: "SET_VEHICLE_VARIANT", id: "vv-1" });
    expect(next.vehicleVariantId).toBe("vv-1");
    expect(next.caravanVariantId).toBeNull();
  });

  it("SET_VEHICLE_VARIANT clears with null", () => {
    const withVehicle: CalculatorState = { ...INITIAL_STATE, vehicleVariantId: "vv-1" };
    const next = calculatorReducer(withVehicle, { type: "SET_VEHICLE_VARIANT", id: null });
    expect(next.vehicleVariantId).toBeNull();
  });

  it("SET_CARAVAN_VARIANT sets caravanVariantId", () => {
    const next = calculatorReducer(INITIAL_STATE, { type: "SET_CARAVAN_VARIANT", id: "cv-1" });
    expect(next.caravanVariantId).toBe("cv-1");
  });

  it("SET_JOURNEY patches journey fields", () => {
    const next = calculatorReducer(INITIAL_STATE, {
      type: "SET_JOURNEY",
      patch: { passengers: 4, fuelPercent: 50 },
    });
    expect(next.journey.passengers).toBe(4);
    expect(next.journey.fuelPercent).toBe(50);
    expect(next.journey.cargoKg).toBe(DEFAULT_JOURNEY.cargoKg);
  });

  it("ADD_ACCESSORY adds an accessory", () => {
    const acc = { accessoryId: "acc-1", massKg: 5, mountingLocation: "roof" };
    const next = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    expect(next.accessories).toHaveLength(1);
    expect(next.accessories[0]).toEqual(acc);
  });

  it("ADD_ACCESSORY is idempotent for same accessoryId", () => {
    const acc = { accessoryId: "acc-1", massKg: 5, mountingLocation: "roof" };
    const withOne = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    const withDup = calculatorReducer(withOne, { type: "ADD_ACCESSORY", accessory: acc });
    expect(withDup.accessories).toHaveLength(1);
  });

  it("REMOVE_ACCESSORY removes by accessoryId", () => {
    const acc1 = { accessoryId: "acc-1", massKg: 5, mountingLocation: "roof" };
    const acc2 = { accessoryId: "acc-2", massKg: 10, mountingLocation: "tow-bar" };
    let state = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc1 });
    state = calculatorReducer(state, { type: "ADD_ACCESSORY", accessory: acc2 });
    const next = calculatorReducer(state, { type: "REMOVE_ACCESSORY", accessoryId: "acc-1" });
    expect(next.accessories).toHaveLength(1);
    expect(next.accessories[0].accessoryId).toBe("acc-2");
  });

  it("SET_VEHICLE_VARIANT with null clears accessories", () => {
    const acc = { accessoryId: "acc-1", massKg: 5, mountingLocation: "roof" };
    const withAcc = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    const next = calculatorReducer(withAcc, { type: "SET_VEHICLE_VARIANT", id: null });
    expect(next.accessories).toHaveLength(0);
    expect(next.vehicleVariantId).toBeNull();
  });

  it("RESET returns INITIAL_STATE", () => {
    const dirty: CalculatorState = {
      vehicleVariantId: "vv-1",
      caravanVariantId: "cv-1",
      journey: { ...DEFAULT_JOURNEY, passengers: 5 },
      caravanAssumptions: { freshWaterL: 0, greyWaterL: 0, gearKg: 0 },
      accessories: [{ accessoryId: "acc-1", massKg: 5, mountingLocation: "roof" }],
      caravanAccessories: [],
    };
    const next = calculatorReducer(dirty, { type: "RESET" });
    expect(next).toEqual(INITIAL_STATE);
  });
});
