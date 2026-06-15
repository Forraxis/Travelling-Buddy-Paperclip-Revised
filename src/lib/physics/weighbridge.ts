// Weighbridge orchestration — bridge between the engine and the calibration
// solver. Given the weighed config C₀ and a measured ticket M₀, compute the
// model prediction P₀ and solve the residual into a positioned unaccounted load
// + static mop-up offsets. UX-independent; the entry panel and API both call this.
//
// See CALIBRATION_SIGNOFF.md.

import { calculate } from './engine';
import {
  solveVehicleCalibration,
  type WeighbridgeMeasurement,
  type CalibrationResult,
  type PredictedVehicle,
  type VehicleGeometry,
} from './calibration';
import { DEFAULT_TRACK_WIDTH_MM } from './position-map';
import type { PhysicsInput } from './types';

export interface WeighbridgeCalibrationOutput extends CalibrationResult {
  /** The raw model prediction P₀ for C₀ — handy for the panel's "before" column. */
  predicted: PredictedVehicle;
}

/**
 * Solve a weighbridge ticket against a config.
 *
 * ⚠ `input` must be the config **as weighed (C₀) with no prior calibration** —
 * i.e. no `calibrationOverrides.vehicleStaticOffsets` and no existing
 * "unaccounted" load among the accessories. Re-calibrating means stripping the
 * previous unaccounted load + offsets first, or P₀ already includes them and the
 * residual collapses to ~0. The caller owns that hygiene.
 */
export function calibrateToWeighbridge(
  input: PhysicsInput,
  measurement: WeighbridgeMeasurement,
  opts: { preferStaticOnly?: boolean } = {},
): WeighbridgeCalibrationOutput {
  const result = calculate(input);
  const v = result.vehicle;

  const predicted: PredictedVehicle = {
    totalKg: v.totalWeightKg,
    frontAxleKg: v.frontAxleKg,
    rearAxleKg: v.rearAxleKg,
    corners: v.lateral?.corners,
  };

  const geom: VehicleGeometry = {
    wheelbaseMm: input.vehicle.wheelbaseMm,
    trackWidthMm: input.vehicle.trackWidthMm ?? DEFAULT_TRACK_WIDTH_MM,
    frontOverhangMm: input.vehicle.frontOverhangMm,
    rearOverhangMm: input.vehicle.rearOverhangMm,
  };

  const solved = solveVehicleCalibration(measurement, predicted, geom, opts);
  return { ...solved, predicted };
}
