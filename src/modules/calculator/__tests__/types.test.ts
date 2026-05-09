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
    const acc = { fitmentId: "fit-1", quantity: 1, fillPercent: 100 };
    const next = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    expect(next.accessories).toHaveLength(1);
    expect(next.accessories[0]).toEqual(acc);
  });

  it("ADD_ACCESSORY is idempotent for same fitmentId", () => {
    const acc = { fitmentId: "fit-1", quantity: 1, fillPercent: 100 };
    const withOne = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    const withDup = calculatorReducer(withOne, { type: "ADD_ACCESSORY", accessory: acc });
    expect(withDup.accessories).toHaveLength(1);
  });

  it("REMOVE_ACCESSORY removes by fitmentId", () => {
    const acc1 = { fitmentId: "fit-1", quantity: 1, fillPercent: 100 };
    const acc2 = { fitmentId: "fit-2", quantity: 2, fillPercent: 50 };
    let state = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc1 });
    state = calculatorReducer(state, { type: "ADD_ACCESSORY", accessory: acc2 });
    const next = calculatorReducer(state, { type: "REMOVE_ACCESSORY", fitmentId: "fit-1" });
    expect(next.accessories).toHaveLength(1);
    expect(next.accessories[0].fitmentId).toBe("fit-2");
  });

  it("UPDATE_ACCESSORY patches matching accessory", () => {
    const acc = { fitmentId: "fit-1", quantity: 1, fillPercent: 100 };
    const withAcc = calculatorReducer(INITIAL_STATE, { type: "ADD_ACCESSORY", accessory: acc });
    const next = calculatorReducer(withAcc, {
      type: "UPDATE_ACCESSORY",
      fitmentId: "fit-1",
      patch: { quantity: 3 },
    });
    expect(next.accessories[0].quantity).toBe(3);
    expect(next.accessories[0].fillPercent).toBe(100);
  });

  it("RESET returns INITIAL_STATE", () => {
    const dirty: CalculatorState = {
      vehicleVariantId: "vv-1",
      caravanVariantId: "cv-1",
      journey: { ...DEFAULT_JOURNEY, passengers: 5 },
      accessories: [{ fitmentId: "fit-1", quantity: 1, fillPercent: 100 }],
    };
    const next = calculatorReducer(dirty, { type: "RESET" });
    expect(next).toEqual(INITIAL_STATE);
  });
});
