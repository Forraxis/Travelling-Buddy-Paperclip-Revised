'use client';

import { useEffect, useState, useMemo } from 'react';
import { calculate } from '@/lib/physics/engine';
import type {
  PhysicsResult,
  PhysicsInput,
  MountingLocation,
} from '@/lib/physics/types';
import {
  buildSchematicModel,
  type SchematicModel,
} from '@/components/schematic/model';
import {
  vehicleProfile,
  vehicleBodyKindFromType,
  caravanProfile,
  caravanBodyKindFromType,
} from '@/components/schematic/vehicle-profiles';
import { useCalculatorState } from './context';

type AnyVariant = Record<string, unknown>;

export interface SnapshotOverrides {
  vehicleSnapshot?: AnyVariant | null;
  caravanSnapshot?: AnyVariant | null;
}

export interface PhysicsView {
  result: PhysicsResult;
  schematic: SchematicModel | null;
}

function rigTitle(
  vehicle: AnyVariant | null,
  caravan: AnyVariant | null,
): string {
  const part = (v: AnyVariant | null): string => {
    if (!v) return '';
    const model = (v.model ?? {}) as AnyVariant;
    const make = (model.make ?? {}) as AnyVariant;
    return [make.name, model.name, v.name].filter(Boolean).join(' ').trim();
  };
  const veh = part(vehicle);
  const car = part(caravan);
  return car ? `${veh} + ${car}` : veh || 'Your rig';
}

/**
 * Computes the physics result and the side-profile schematic model from the
 * current calculator state. Returns null until a vehicle is selected and its
 * spec has loaded. {@link usePhysicsResult} is a thin selector over this.
 */
export function usePhysicsView(
  snapshots?: SnapshotOverrides,
): PhysicsView | null {
  const { state } = useCalculatorState();
  const [vehicleVariant, setVehicleVariant] = useState<AnyVariant | null>(null);
  const [caravanVariant, setCaravanVariant] = useState<AnyVariant | null>(null);

  useEffect(() => {
    if (!state.vehicleVariantId) {
      setVehicleVariant(null);
      return;
    }
    let active = true;
    fetch(`/api/v1/vehicles/variants/${state.vehicleVariantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setVehicleVariant(data);
      })
      .catch(() => {
        if (active) setVehicleVariant(null);
      });
    return () => {
      active = false;
    };
  }, [state.vehicleVariantId]);

  useEffect(() => {
    if (!state.caravanVariantId) {
      setCaravanVariant(null);
      return;
    }
    let active = true;
    fetch(`/api/v1/caravans/variants/${state.caravanVariantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setCaravanVariant(data);
      })
      .catch(() => {
        if (active) setCaravanVariant(null);
      });
    return () => {
      active = false;
    };
  }, [state.caravanVariantId]);

  const effectiveVehicle = vehicleVariant ?? snapshots?.vehicleSnapshot ?? null;
  const effectiveCaravan = caravanVariant ?? snapshots?.caravanSnapshot ?? null;

  return useMemo(() => {
    if (!effectiveVehicle) return null;

    const freshWaterCapL = Number(effectiveCaravan?.freshWaterCapacityL ?? 0);
    const greyWaterCapL = Number(effectiveCaravan?.greyWaterCapacityL ?? 0);
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

    const input: PhysicsInput = {
      vehicle: {
        gvmKg: Number(effectiveVehicle.gvmKg),
        gcmKg: Number(effectiveVehicle.gcmKg),
        kerbWeightKg: Number(effectiveVehicle.kerbWeightKg),
        maxTowingCapacityKg: Number(effectiveVehicle.maxTowingCapacityKg),
        frontAxleLimitKg: Number(effectiveVehicle.frontAxleLimitKg),
        rearAxleLimitKg: Number(effectiveVehicle.rearAxleLimitKg),
        maxTowBallDownloadKg: Number(effectiveVehicle.maxTowBallDownloadKg),
        wheelbaseMm: Number(effectiveVehicle.wheelbaseMm),
        frontOverhangMm:
          effectiveVehicle.frontOverhangMm != null
            ? Number(effectiveVehicle.frontOverhangMm)
            : null,
        rearOverhangMm:
          effectiveVehicle.rearOverhangMm != null
            ? Number(effectiveVehicle.rearOverhangMm)
            : null,
        trackWidthMm: vehicleProfile(
          vehicleBodyKindFromType(
            ((effectiveVehicle.model ?? {}) as AnyVariant).bodyType as
              | string
              | undefined,
          ),
        ).trackWidthMm,
        fuelTankCapacityL: Number(effectiveVehicle.fuelTankCapacityL),
        fuelType: effectiveVehicle.fuelType as
          | 'DIESEL'
          | 'PETROL'
          | 'HYBRID'
          | 'ELECTRIC',
      },
      caravan: effectiveCaravan
        ? {
            atmKg: Number(effectiveCaravan.atmKg),
            gtmKg: Number(effectiveCaravan.gtmKg),
            tareKg: Number(effectiveCaravan.tareKg),
            tbmKg: Number(effectiveCaravan.tbmKg),
            axleConfiguration: effectiveCaravan.axleConfiguration as
              | 'SINGLE_AXLE'
              | 'DUAL_AXLE_CLOSE_COUPLED'
              | 'DUAL_AXLE_SPREAD'
              | 'TRIPLE_AXLE',
            couplingToAxleMm: Number(effectiveCaravan.couplingToAxleMm),
            axleSpacingMm:
              effectiveCaravan.axleSpacingMm != null
                ? Number(effectiveCaravan.axleSpacingMm)
                : null,
            freshWaterCapacityL: freshWaterCapL,
            greyWaterCapacityL: greyWaterCapL,
            trackWidthMm: caravanProfile(
              caravanBodyKindFromType(
                ((effectiveCaravan.model ?? {}) as AnyVariant).bodyType as
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
        ...state.customLoads
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
        ...state.customLoads
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
      calibrationOverrides: {
        caravanTareKg: state.caravanAssumptions.gearKg,
        // Weighbridge static mop-up offsets (the positioned unaccounted load is
        // already among customLoads). See CALIBRATION_SIGNOFF.md §5.
        vehicleStaticOffsets:
          state.calibration?.vehicleStaticOffsets ?? undefined,
      },
      regulationSetCode: 'AU_ADR',
    };

    try {
      const result = calculate(input);
      const schematic = buildSchematicModel({
        title: rigTitle(effectiveVehicle, effectiveCaravan),
        vehicle: {
          wheelbaseMm: Number(effectiveVehicle.wheelbaseMm),
          frontOverhangMm:
            effectiveVehicle.frontOverhangMm != null
              ? Number(effectiveVehicle.frontOverhangMm)
              : null,
          rearOverhangMm:
            effectiveVehicle.rearOverhangMm != null
              ? Number(effectiveVehicle.rearOverhangMm)
              : null,
          bodyType: ((effectiveVehicle.model ?? {}) as AnyVariant).bodyType as
            | string
            | undefined,
        },
        caravan: effectiveCaravan
          ? {
              couplingToAxleMm: Number(effectiveCaravan.couplingToAxleMm),
              axleSpacingMm:
                effectiveCaravan.axleSpacingMm != null
                  ? Number(effectiveCaravan.axleSpacingMm)
                  : null,
              bodyLengthMm:
                effectiveCaravan.bodyLengthMm != null
                  ? Number(effectiveCaravan.bodyLengthMm)
                  : null,
              overallLengthMm:
                effectiveCaravan.overallLengthMm != null
                  ? Number(effectiveCaravan.overallLengthMm)
                  : null,
              axleConfiguration: String(effectiveCaravan.axleConfiguration),
              bodyType: ((effectiveCaravan.model ?? {}) as AnyVariant)
                .bodyType as string | undefined,
            }
          : null,
        vehicleAccessories: [
          ...state.accessories.map((a) => ({
            id: a.accessoryId,
            weightKg: a.massKg,
            mountingLocation: a.mountingLocation as MountingLocation,
            cogXMm: a.cogXMm,
            cogYMm: a.cogYMm,
            label: a.label,
            topDownImageUrl: a.topDownImageUrl,
          })),
          ...state.customLoads
            .filter((l) => l.side === 'vehicle')
            .map((l) => ({
              id: l.id,
              weightKg: l.massKg,
              mountingLocation: 'CHASSIS_MID' as MountingLocation,
              cogXMm: l.cogXMm,
              cogYMm: l.cogYMm,
              label: l.label,
              footprintLengthMm: l.footprintLengthMm,
              footprintWidthMm: l.footprintWidthMm,
            })),
        ],
        caravanAccessories: [
          ...state.caravanAccessories.map((a) => ({
            id: a.accessoryId,
            weightKg: a.massKg,
            mountingLocation: a.mountingLocation as MountingLocation,
            cogXMm: a.cogXMm,
            cogYMm: a.cogYMm,
            label: a.label,
            topDownImageUrl: a.topDownImageUrl,
          })),
          ...state.customLoads
            .filter((l) => l.side === 'caravan')
            .map((l) => ({
              id: l.id,
              weightKg: l.massKg,
              mountingLocation: 'CARAVAN_CHASSIS_MID' as MountingLocation,
              cogXMm: l.cogXMm,
              cogYMm: l.cogYMm,
              label: l.label,
              footprintLengthMm: l.footprintLengthMm,
              footprintWidthMm: l.footprintWidthMm,
            })),
        ],
        result,
      });
      return { result, schematic };
    } catch {
      return null;
    }
  }, [effectiveVehicle, effectiveCaravan, state]);
}

export function usePhysicsResult(
  snapshots?: SnapshotOverrides,
): PhysicsResult | null {
  return usePhysicsView(snapshots)?.result ?? null;
}
