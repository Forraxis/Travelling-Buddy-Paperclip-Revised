import type { PhysicsInput, MetricStatus } from "./types";

export interface RegulationLimits {
  gvmKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  gcmKg: number | null;
  towBallDownloadLimitKg: number | null;
  atmKg: number | null;
  gtmKg: number | null;
  warnThreshold: number;
  tbmPctOkMin: number;
  tbmPctOkMax: number;
  tbmPctWarnMin: number;
  tbmPctWarnMax: number;
}

export function getRegulations(input: PhysicsInput): RegulationLimits {
  const { vehicle, caravan } = input;

  const towBallDownloadLimitKg = caravan
    ? Math.min(
        vehicle.maxTowBallDownloadKg,
        caravan.atmKg * 0.1
      )
    : null;

  return {
    gvmKg: vehicle.gvmKg,
    frontAxleLimitKg: vehicle.frontAxleLimitKg,
    rearAxleLimitKg: vehicle.rearAxleLimitKg,
    gcmKg: caravan ? vehicle.gcmKg : null,
    towBallDownloadLimitKg,
    atmKg: caravan ? caravan.atmKg : null,
    gtmKg: caravan ? caravan.gtmKg : null,
    warnThreshold: 0.9,
    tbmPctOkMin: 9,
    tbmPctOkMax: 11,
    tbmPctWarnMin: 7,
    tbmPctWarnMax: 12,
  };
}

export function weightStatus(
  actual: number,
  limit: number,
  warnThreshold = 0.9
): MetricStatus {
  const ratio = actual / limit;
  if (ratio > 1) return "fail";
  if (ratio > warnThreshold) return "warn";
  return "ok";
}

export function tbmPctStatus(pct: number): MetricStatus {
  if (pct < 7 || pct > 12) return "fail";
  if (pct < 9 || pct > 11) return "warn";
  return "ok";
}
