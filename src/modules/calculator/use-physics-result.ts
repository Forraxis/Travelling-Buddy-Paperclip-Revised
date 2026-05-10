'use client';

import { useEffect, useState, useMemo } from 'react';
import { calculate } from '@/lib/physics/engine';
import type { PhysicsResult, PhysicsInput, MountingLocation } from '@/lib/physics/types';
import { useCalculatorState } from './context';

type AnyVariant = Record<string, unknown>;

export function usePhysicsResult(): PhysicsResult | null {
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

  return useMemo(() => {
    if (!vehicleVariant) return null;

    const freshWaterCapL = Number(caravanVariant?.freshWaterCapacityL ?? 0);
    const greyWaterCapL = Number(caravanVariant?.greyWaterCapacityL ?? 0);
    const freshWaterPercent = freshWaterCapL > 0
      ? Math.min(100, (state.caravanAssumptions.freshWaterL / freshWaterCapL) * 100)
      : 0;
    const greyWaterPercent = greyWaterCapL > 0
      ? Math.min(100, (state.caravanAssumptions.greyWaterL / greyWaterCapL) * 100)
      : 0;

    const input: PhysicsInput = {
      vehicle: {
        gvmKg: Number(vehicleVariant.gvmKg),
        gcmKg: Number(vehicleVariant.gcmKg),
        kerbWeightKg: Number(vehicleVariant.kerbWeightKg),
        maxTowingCapacityKg: Number(vehicleVariant.maxTowingCapacityKg),
        frontAxleLimitKg: Number(vehicleVariant.frontAxleLimitKg),
        rearAxleLimitKg: Number(vehicleVariant.rearAxleLimitKg),
        maxTowBallDownloadKg: Number(vehicleVariant.maxTowBallDownloadKg),
        wheelbaseMm: Number(vehicleVariant.wheelbaseMm),
        frontOverhangMm: vehicleVariant.frontOverhangMm != null ? Number(vehicleVariant.frontOverhangMm) : null,
        rearOverhangMm: vehicleVariant.rearOverhangMm != null ? Number(vehicleVariant.rearOverhangMm) : null,
        fuelTankCapacityL: Number(vehicleVariant.fuelTankCapacityL),
        fuelType: vehicleVariant.fuelType as 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC',
      },
      caravan: caravanVariant ? {
        atmKg: Number(caravanVariant.atmKg),
        gtmKg: Number(caravanVariant.gtmKg),
        tareKg: Number(caravanVariant.tareKg),
        tbmKg: Number(caravanVariant.tbmKg),
        axleConfiguration: caravanVariant.axleConfiguration as 'SINGLE_AXLE' | 'DUAL_AXLE_CLOSE_COUPLED' | 'DUAL_AXLE_SPREAD' | 'TRIPLE_AXLE',
        couplingToAxleMm: Number(caravanVariant.couplingToAxleMm),
        axleSpacingMm: caravanVariant.axleSpacingMm != null ? Number(caravanVariant.axleSpacingMm) : null,
        freshWaterCapacityL: freshWaterCapL,
        greyWaterCapacityL: greyWaterCapL,
      } : undefined,
      vehicleAccessories: state.accessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        fillPercent: 100,
        quantity: 1,
      })),
      caravanAccessories: [],
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
  }, [vehicleVariant, caravanVariant, state]);
}
