'use client';

import { useEffect, useState, useMemo } from 'react';
import { calculate } from '@/lib/physics/engine';
import type {
  PhysicsResult,
  PhysicsInput,
  MountingLocation,
} from '@/lib/physics/types';
import { buildPhysicsInput } from './build-physics-input';
import {
  buildSchematicModel,
  type SchematicModel,
} from '@/components/schematic/model';
import { useCalculatorState } from './context';

type AnyVariant = Record<string, unknown>;

export interface SnapshotOverrides {
  vehicleSnapshot?: AnyVariant | null;
  caravanSnapshot?: AnyVariant | null;
}

export interface PhysicsView {
  result: PhysicsResult;
  schematic: SchematicModel | null;
  /** The live engine input (includes calibration). */
  input: PhysicsInput;
  /**
   * The clean pre-calibration anchor C₀ (no offsets, no unaccounted load) —
   * what the weighbridge panel re-solves a ticket against.
   */
  baselineInput: PhysicsInput;
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

    const input = buildPhysicsInput(
      state,
      effectiveVehicle,
      effectiveCaravan,
      'live',
    );

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
              isUnaccounted: l.isUnaccounted,
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
              isUnaccounted: l.isUnaccounted,
            })),
        ],
        result,
      });
      const baselineInput = buildPhysicsInput(
        state,
        effectiveVehicle,
        effectiveCaravan,
        'baseline',
      );
      return { result, schematic, input, baselineInput };
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
