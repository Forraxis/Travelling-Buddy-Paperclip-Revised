import { describe, it, expect } from 'vitest';
import { buildResultSummary } from '../setup-versions';
import { calculate } from '@/lib/physics/engine';
import type { PhysicsInput } from '@/lib/physics/types';

const soloInput: PhysicsInput = {
  vehicle: {
    gvmKg: 3200,
    gcmKg: 6000,
    kerbWeightKg: 2160,
    maxTowingCapacityKg: 3500,
    frontAxleLimitKg: 1500,
    rearAxleLimitKg: 1850,
    maxTowBallDownloadKg: 350,
    wheelbaseMm: 3085,
    fuelTankCapacityL: 80,
    fuelType: 'DIESEL',
  },
  vehicleAccessories: [],
  passengers: 2,
  cargoKg: 0,
  fuelPercent: 100,
  freshWaterPercent: 0,
  greyWaterPercent: 0,
  regulationSetCode: 'AU_ADR',
};

describe('buildResultSummary', () => {
  it('captures rounded vehicle metrics + limits', () => {
    const result = calculate(soloInput);
    const s = buildResultSummary(result, false);
    expect(s.overallStatus).toBe(result.overallStatus);
    expect(s.gvmKg).toBe(Math.round(result.vehicle.totalWeightKg));
    expect(s.gvmLimitKg).toBe(3200);
    expect(s.frontAxleLimitKg).toBe(1500);
    expect(s.rearAxleLimitKg).toBe(1850);
    expect(s.calibrated).toBe(false);
    // solo rig → no caravan/tow-ball fields
    expect(s.towBallKg).toBeUndefined();
    expect(s.caravanAtmKg).toBeUndefined();
  });

  it('flags calibrated and includes caravan metrics when towing', () => {
    const towing: PhysicsInput = {
      ...soloInput,
      caravan: {
        atmKg: 3000,
        gtmKg: 2700,
        tareKg: 2200,
        tbmKg: 180,
        axleConfiguration: 'SINGLE_AXLE',
        couplingToAxleMm: 4500,
        freshWaterCapacityL: 100,
        greyWaterCapacityL: 0,
      },
      caravanAccessories: [],
    };
    const s = buildResultSummary(calculate(towing), true);
    expect(s.calibrated).toBe(true);
    expect(s.towBallKg).toBeTypeOf('number');
    expect(s.caravanAtmKg).toBeTypeOf('number');
    expect(s.caravanGtmKg).toBeTypeOf('number');
    expect(s.gcmKg).toBeTypeOf('number');
  });
});
