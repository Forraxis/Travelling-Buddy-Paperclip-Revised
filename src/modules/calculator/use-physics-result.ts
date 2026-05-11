'use client';

import { useEffect, useState, useMemo } from 'react';
import { calculate } from '@/lib/physics/engine';
import type { PhysicsResult, PhysicsInput, MountingLocation } from '@/lib/physics/types';
import { useCalculatorState } from './context';

type AnyVariant = Record<string, unknown>;

export interface SnapshotOverrides {
  vehicleSnapshot?: AnyVariant | null;
  caravanSnapshot?: AnyVariant | null;
}

export function usePhysicsResult(snapshots?: SnapshotOverrides): PhysicsResult | null {
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
      .then((data) => { if (active) setVehicleVariant(data); })
      .catch(() => { if (active) setVehicleVariant(null); });
    return () => { active = false; };
  }, [state.vehicleVariantId]);

  useEffect(() => {
    if (!state.caravanVariantId) {
      setCaravanVariant(null);
      return;
    }
    let active = true;
    fetch(`/api/v1/caravans/variants/${state.caravanVariantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (active) setCaravanVariant(data); })
      .catch(() => { if (active) setCaravanVariant(null); });
    return () => { active = false; };
  }, [state.caravanVariantId]);

  const effectiveVehicle = vehicleVariant ?? snapshots?.vehicleSnapshot ?? null;
  const effectiveCaravan = caravanVariant ?? snapshots?.caravanSnapshot ?? null;

  return useMemo(() => {
    if (!effectiveVehicle) return null;

    const freshWaterCapL = Number(effectiveCaravan?.freshWaterCapacityL ?? 0);
    const greyWaterCapL = Number(effectiveCaravan?.greyWaterCapacityL ?? 0);
    const freshWaterPercent = freshWaterCapL > 0
      ? Math.min(100, (state.caravanAssumptions.freshWaterL / freshWaterCapL) * 100)
      : 0;
    const greyWaterPercent = greyWaterCapL > 0
      ? Math.min(100, (state.caravanAssumptions.greyWaterL / greyWaterCapL) * 100)
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
        frontOverhangMm: effectiveVehicle.frontOverhangMm != null ? Number(effectiveVehicle.frontOverhangMm) : null,
        rearOverhangMm: effectiveVehicle.rearOverhangMm != null ? Number(effectiveVehicle.rearOverhangMm) : null,
        fuelTankCapacityL: Number(effectiveVehicle.fuelTankCapacityL),
        fuelType: effectiveVehicle.fuelType as 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC',
      },
      caravan: effectiveCaravan ? {
        atmKg: Number(effectiveCaravan.atmKg),
        gtmKg: Number(effectiveCaravan.gtmKg),
        tareKg: Number(effectiveCaravan.tareKg),
        tbmKg: Number(effectiveCaravan.tbmKg),
        axleConfiguration: effectiveCaravan.axleConfiguration as 'SINGLE_AXLE' | 'DUAL_AXLE_CLOSE_COUPLED' | 'DUAL_AXLE_SPREAD' | 'TRIPLE_AXLE',
        couplingToAxleMm: Number(effectiveCaravan.couplingToAxleMm),
        axleSpacingMm: effectiveCaravan.axleSpacingMm != null ? Number(effectiveCaravan.axleSpacingMm) : null,
        freshWaterCapacityL: freshWaterCapL,
        greyWaterCapacityL: greyWaterCapL,
      } : undefined,
      vehicleAccessories: state.accessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        fillPercent: 100,
        quantity: 1,
      })),
      caravanAccessories: state.caravanAccessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        fillPercent: 100,
        quantity: 1,
      })),
      passengers: state.journey.passengers,
      cargoKg: state.journey.cargoKg,
      fuelPercent: state.journey.fuelPercent,
      freshWaterPercent,
      greyWaterPercent,
      calibrationOverrides: {
        caravanTareKg: state.caravanAssumptions.gearKg,
      },
      regulationSetCode: 'AU_ADR',
    };

    try {
      return calculate(input);
    } catch {
      return null;
    }
  }, [effectiveVehicle, effectiveCaravan, state]);
}
