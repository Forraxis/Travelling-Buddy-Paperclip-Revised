import type { CalculatorState, JourneyAssumptions } from "./types";
import { DEFAULT_JOURNEY, INITIAL_STATE } from "./types";

const PARAM = {
  vehicleVariantId: "vehicleVariantId",
  caravanVariantId: "caravanVariantId",
  passengers: "passengers",
  cargoKg: "cargoKg",
  fuelPercent: "fuelPercent",
  freshWaterPercent: "freshWaterPercent",
  greyWaterPercent: "greyWaterPercent",
  gearKg: "gearKg",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseIntParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function parseFloatParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

export function stateToParams(state: CalculatorState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.vehicleVariantId) {
    params.set(PARAM.vehicleVariantId, state.vehicleVariantId);
  }
  if (state.caravanVariantId) {
    params.set(PARAM.caravanVariantId, state.caravanVariantId);
  }

  const j = state.journey;
  if (j.passengers !== DEFAULT_JOURNEY.passengers) {
    params.set(PARAM.passengers, String(j.passengers));
  }
  if (j.cargoKg !== DEFAULT_JOURNEY.cargoKg) {
    params.set(PARAM.cargoKg, String(j.cargoKg));
  }
  if (j.fuelPercent !== DEFAULT_JOURNEY.fuelPercent) {
    params.set(PARAM.fuelPercent, String(j.fuelPercent));
  }
  if (j.freshWaterPercent !== DEFAULT_JOURNEY.freshWaterPercent) {
    params.set(PARAM.freshWaterPercent, String(j.freshWaterPercent));
  }
  if (j.greyWaterPercent !== DEFAULT_JOURNEY.greyWaterPercent) {
    params.set(PARAM.greyWaterPercent, String(j.greyWaterPercent));
  }
  if (j.gearKg !== DEFAULT_JOURNEY.gearKg) {
    params.set(PARAM.gearKg, String(j.gearKg));
  }

  return params;
}

export function paramsToState(params: URLSearchParams): CalculatorState {
  const vehicleVariantId = params.get(PARAM.vehicleVariantId) ?? null;
  const caravanVariantId = params.get(PARAM.caravanVariantId) ?? null;

  const journey: JourneyAssumptions = {
    passengers: clamp(parseIntParam(params, PARAM.passengers) ?? DEFAULT_JOURNEY.passengers, 1, 9),
    cargoKg: clamp(parseFloatParam(params, PARAM.cargoKg) ?? DEFAULT_JOURNEY.cargoKg, 0, 5000),
    fuelPercent: clamp(parseIntParam(params, PARAM.fuelPercent) ?? DEFAULT_JOURNEY.fuelPercent, 0, 100),
    freshWaterPercent: clamp(
      parseIntParam(params, PARAM.freshWaterPercent) ?? DEFAULT_JOURNEY.freshWaterPercent,
      0,
      100,
    ),
    greyWaterPercent: clamp(
      parseIntParam(params, PARAM.greyWaterPercent) ?? DEFAULT_JOURNEY.greyWaterPercent,
      0,
      100,
    ),
    gearKg: clamp(parseFloatParam(params, PARAM.gearKg) ?? DEFAULT_JOURNEY.gearKg, 0, 5000),
  };

  return {
    ...INITIAL_STATE,
    vehicleVariantId,
    caravanVariantId,
    journey,
  };
}
