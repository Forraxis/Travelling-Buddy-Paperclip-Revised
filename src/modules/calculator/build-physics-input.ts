import type {
  PhysicsInput,
  MountingLocation,
  CalibrationOverrides,
} from '@/lib/physics/types';
import {
  mergeModelCorrection,
  type ModelCorrection,
} from '@/lib/physics/calibration-contribution';
import {
  vehicleProfile,
  vehicleBodyKindFromType,
  caravanProfile,
  caravanBodyKindFromType,
} from '@/components/schematic/vehicle-profiles';
import type { CalculatorState } from './types';

type AnyVariant = Record<string, unknown>;

/**
 * How calibration folds into the built input:
 * - `live` — the config the user sees: includes the positioned "unaccounted"
 *   load (it's a real placed load) and the solved `vehicleStaticOffsets`.
 * - `baseline` — the clean anchor C₀: EXCLUDES the unaccounted load and applies
 *   NO offsets. This is what we re-solve a weighbridge ticket against, so P₀
 *   never double-counts a previous calibration. See CALIBRATION_SIGNOFF.md.
 */
export type PhysicsInputMode = 'live' | 'baseline';

/**
 * Pure builder for the physics engine input from calculator state + the loaded
 * variant specs. Shared by {@link usePhysicsView} (live) and the weighbridge
 * calibration panel (baseline). No React / I/O.
 */
export function buildPhysicsInput(
  state: CalculatorState,
  vehicle: AnyVariant,
  caravan: AnyVariant | null,
  mode: PhysicsInputMode = 'live',
): PhysicsInput {
  const freshWaterCapL = Number(caravan?.freshWaterCapacityL ?? 0);
  const greyWaterCapL = Number(caravan?.greyWaterCapacityL ?? 0);
  const freshWaterPercent =
    freshWaterCapL > 0
      ? Math.min(
          100,
          (state.caravanAssumptions.freshWaterL / freshWaterCapL) * 100,
        )
      : 0;
  const greyWaterPercent =
    greyWaterCapL > 0
      ? Math.min(
          100,
          (state.caravanAssumptions.greyWaterL / greyWaterCapL) * 100,
        )
      : 0;

  // In baseline mode, drop the positioned unaccounted load so P₀ is the clean
  // pre-calibration prediction.
  const customLoads =
    mode === 'baseline'
      ? state.customLoads.filter((l) => !l.isUnaccounted)
      : state.customLoads;

  // P3 per-model correction (kerb-mass / kerb-CoG). Applied ONLY in live mode,
  // and ONLY when the user hasn't anchored to their own weighbridge ticket —
  // their measured reality always beats the crowd estimate. NEVER in baseline,
  // so a contribution's P₀ is computed against the raw model and corrections
  // can't feed back on their own predictions. See CALIBRATION_SIGNOFF.md §9.
  const baseOverrides: CalibrationOverrides = {
    caravanTareKg: state.caravanAssumptions.gearKg,
    vehicleStaticOffsets:
      mode === 'live'
        ? (state.calibration?.vehicleStaticOffsets ?? undefined)
        : undefined,
  };
  const modelCorrection: ModelCorrection | null =
    mode === 'live' && !state.calibration
      ? ((vehicle.calibrationCorrection as
          | ModelCorrection
          | null
          | undefined) ?? null)
      : null;
  const calibrationOverrides =
    mergeModelCorrection(baseOverrides, modelCorrection) ?? baseOverrides;

  return {
    vehicle: {
      gvmKg: Number(vehicle.gvmKg),
      gcmKg: Number(vehicle.gcmKg),
      kerbWeightKg: Number(vehicle.kerbWeightKg),
      maxTowingCapacityKg: Number(vehicle.maxTowingCapacityKg),
      frontAxleLimitKg: Number(vehicle.frontAxleLimitKg),
      rearAxleLimitKg: Number(vehicle.rearAxleLimitKg),
      maxTowBallDownloadKg: Number(vehicle.maxTowBallDownloadKg),
      wheelbaseMm: Number(vehicle.wheelbaseMm),
      frontOverhangMm:
        vehicle.frontOverhangMm != null
          ? Number(vehicle.frontOverhangMm)
          : null,
      rearOverhangMm:
        vehicle.rearOverhangMm != null ? Number(vehicle.rearOverhangMm) : null,
      trackWidthMm: vehicleProfile(
        vehicleBodyKindFromType(
          ((vehicle.model ?? {}) as AnyVariant).bodyType as string | undefined,
        ),
      ).trackWidthMm,
      fuelTankCapacityL: Number(vehicle.fuelTankCapacityL),
      fuelType: vehicle.fuelType as 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC',
    },
    caravan: caravan
      ? {
          atmKg: Number(caravan.atmKg),
          gtmKg: Number(caravan.gtmKg),
          tareKg: Number(caravan.tareKg),
          tbmKg: Number(caravan.tbmKg),
          axleConfiguration: caravan.axleConfiguration as
            | 'SINGLE_AXLE'
            | 'DUAL_AXLE_CLOSE_COUPLED'
            | 'DUAL_AXLE_SPREAD'
            | 'TRIPLE_AXLE',
          couplingToAxleMm: Number(caravan.couplingToAxleMm),
          axleSpacingMm:
            caravan.axleSpacingMm != null
              ? Number(caravan.axleSpacingMm)
              : null,
          freshWaterCapacityL: freshWaterCapL,
          greyWaterCapacityL: greyWaterCapL,
          trackWidthMm: caravanProfile(
            caravanBodyKindFromType(
              ((caravan.model ?? {}) as AnyVariant).bodyType as
                | string
                | undefined,
            ),
          ).trackWidthMm,
        }
      : undefined,
    vehicleAccessories: [
      ...state.accessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        cogXMm: a.cogXMm,
        cogYMm: a.cogYMm,
        fillPercent: 100,
        quantity: 1,
      })),
      ...customLoads
        .filter((l) => l.side === 'vehicle')
        .map((l) => ({
          installedWeightKg: l.massKg,
          mountingLocation: 'CHASSIS_MID' as MountingLocation,
          cogXMm: l.cogXMm,
          cogYMm: l.cogYMm,
          fillPercent: 100,
          quantity: 1,
        })),
    ],
    caravanAccessories: [
      ...state.caravanAccessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        cogXMm: a.cogXMm,
        cogYMm: a.cogYMm,
        fillPercent: 100,
        quantity: 1,
      })),
      ...customLoads
        .filter((l) => l.side === 'caravan')
        .map((l) => ({
          installedWeightKg: l.massKg,
          mountingLocation: 'CARAVAN_CHASSIS_MID' as MountingLocation,
          cogXMm: l.cogXMm,
          cogYMm: l.cogYMm,
          fillPercent: 100,
          quantity: 1,
        })),
    ],
    passengers: state.journey.passengers,
    passengerAvgWeightKg: state.journey.passengerWeightKg,
    cargoKg: state.journey.cargoKg,
    fuelPercent: state.journey.fuelPercent,
    freshWaterPercent,
    greyWaterPercent,
    calibrationOverrides,
    regulationSetCode: 'AU_ADR',
  };
}
