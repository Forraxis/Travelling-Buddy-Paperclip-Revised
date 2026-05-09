import { describe, expect, it } from "vitest";
import { stateToParams, paramsToState } from "../url-params";
import { INITIAL_STATE, DEFAULT_JOURNEY } from "../types";
import type { CalculatorState } from "../types";

describe("stateToParams", () => {
  it("produces empty params for initial state", () => {
    const params = stateToParams(INITIAL_STATE);
    expect(params.toString()).toBe("");
  });

  it("encodes vehicleVariantId", () => {
    const state: CalculatorState = { ...INITIAL_STATE, vehicleVariantId: "vv-abc" };
    expect(stateToParams(state).get("vehicleVariantId")).toBe("vv-abc");
  });

  it("encodes caravanVariantId", () => {
    const state: CalculatorState = { ...INITIAL_STATE, caravanVariantId: "cv-xyz" };
    expect(stateToParams(state).get("caravanVariantId")).toBe("cv-xyz");
  });

  it("omits journey fields at defaults", () => {
    const params = stateToParams(INITIAL_STATE);
    expect(params.has("passengers")).toBe(false);
    expect(params.has("fuelPercent")).toBe(false);
  });

  it("encodes non-default journey fields", () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      journey: { ...DEFAULT_JOURNEY, passengers: 4, fuelPercent: 50 },
    };
    const params = stateToParams(state);
    expect(params.get("passengers")).toBe("4");
    expect(params.get("fuelPercent")).toBe("50");
    expect(params.has("cargoKg")).toBe(false);
  });
});

describe("paramsToState", () => {
  it("returns initial state for empty params", () => {
    const state = paramsToState(new URLSearchParams());
    expect(state).toEqual(INITIAL_STATE);
  });

  it("restores vehicleVariantId from params", () => {
    const params = new URLSearchParams("vehicleVariantId=vv-abc");
    const state = paramsToState(params);
    expect(state.vehicleVariantId).toBe("vv-abc");
    expect(state.caravanVariantId).toBeNull();
  });

  it("restores both variant IDs", () => {
    const params = new URLSearchParams("vehicleVariantId=vv-1&caravanVariantId=cv-2");
    const state = paramsToState(params);
    expect(state.vehicleVariantId).toBe("vv-1");
    expect(state.caravanVariantId).toBe("cv-2");
  });

  it("restores journey assumptions", () => {
    const params = new URLSearchParams("passengers=4&fuelPercent=50&cargoKg=80");
    const state = paramsToState(params);
    expect(state.journey.passengers).toBe(4);
    expect(state.journey.fuelPercent).toBe(50);
    expect(state.journey.cargoKg).toBe(80);
    expect(state.journey.freshWaterPercent).toBe(DEFAULT_JOURNEY.freshWaterPercent);
  });

  it("clamps passengers to valid range", () => {
    expect(paramsToState(new URLSearchParams("passengers=0")).journey.passengers).toBe(1);
    expect(paramsToState(new URLSearchParams("passengers=99")).journey.passengers).toBe(9);
  });

  it("clamps percent values to 0-100", () => {
    expect(paramsToState(new URLSearchParams("fuelPercent=-10")).journey.fuelPercent).toBe(0);
    expect(paramsToState(new URLSearchParams("fuelPercent=200")).journey.fuelPercent).toBe(100);
  });

  it("ignores invalid numeric values and falls back to defaults", () => {
    const params = new URLSearchParams("passengers=not-a-number");
    const state = paramsToState(params);
    expect(state.journey.passengers).toBe(DEFAULT_JOURNEY.passengers);
  });

  it("round-trips through stateToParams → paramsToState", () => {
    const original: CalculatorState = {
      vehicleVariantId: "vv-abc",
      caravanVariantId: "cv-xyz",
      journey: { passengers: 3, cargoKg: 50, fuelPercent: 75, freshWaterPercent: 80, greyWaterPercent: 20, gearKg: 10 },
      accessories: [],
    };
    const restored = paramsToState(stateToParams(original));
    expect(restored.vehicleVariantId).toBe("vv-abc");
    expect(restored.caravanVariantId).toBe("cv-xyz");
    expect(restored.journey).toEqual(original.journey);
  });
});
