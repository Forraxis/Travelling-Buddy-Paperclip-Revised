import { describe, it, expect } from 'vitest';
import { calibrateToWeighbridge } from '../weighbridge';
import { calculate } from '../engine';
import type { PhysicsInput } from '../types';

const baseInput: PhysicsInput = {
  vehicle: {
    gvmKg: 3200,
    gcmKg: 6000,
    kerbWeightKg: 2160,
    maxTowingCapacityKg: 3500,
    frontAxleLimitKg: 1500,
    rearAxleLimitKg: 1850,
    maxTowBallDownloadKg: 350,
    wheelbaseMm: 3085,
    frontOverhangMm: 900,
    rearOverhangMm: 450,
    trackWidthMm: 1650,
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

describe('calibrateToWeighbridge — end-to-end solve against the engine', () => {
  it('total ticket: residual = measured − model total, placed at best guess', () => {
    const p0 = calculate(baseInput).vehicle;
    const measuredTotal = p0.totalWeightKg + 90;
    const out = calibrateToWeighbridge(baseInput, {
      granularity: 'TOTAL',
      totalKg: measuredTotal,
    });
    expect(out.predicted.totalKg).toBeCloseTo(p0.totalWeightKg, 1);
    expect(out.unaccountedLoad!.massKg).toBeCloseTo(90, 0);
    expect(out.unaccountedLoad!.isBestGuessPosition).toBe(true);
  });

  it('axle ticket: the fed-back load + offsets reproduce the measured axles', () => {
    const p0 = calculate(baseInput).vehicle;
    const measuredFront = p0.frontAxleKg + 30;
    const measuredRear = p0.rearAxleKg + 90;

    const out = calibrateToWeighbridge(baseInput, {
      granularity: 'AXLE',
      frontAxleKg: measuredFront,
      rearAxleKg: measuredRear,
    });
    expect(out.unaccountedLoad).not.toBeNull();

    // Re-run the engine WITH the solved load + offsets and confirm it now reads
    // the measured ticket — the whole point of calibration.
    const load = out.unaccountedLoad!;
    const calibrated = calculate({
      ...baseInput,
      vehicleAccessories: [
        {
          installedWeightKg: load.massKg,
          mountingLocation: 'CHASSIS_MID',
          cogXMm: load.cogXMm,
          cogYMm: load.cogYMm,
          fillPercent: 100,
          quantity: 1,
        },
      ],
      calibrationOverrides: { vehicleStaticOffsets: out.staticOffsets },
    });
    expect(calibrated.vehicle.frontAxleKg).toBeCloseTo(measuredFront, 0);
    expect(calibrated.vehicle.rearAxleKg).toBeCloseTo(measuredRear, 0);
    expect(calibrated.vehicle.totalWeightKg).toBeCloseTo(
      measuredFront + measuredRear,
      0,
    );
  });

  it('preferStaticOnly propagates through the bridge', () => {
    const p0 = calculate(baseInput).vehicle;
    const out = calibrateToWeighbridge(
      baseInput,
      {
        granularity: 'AXLE',
        frontAxleKg: p0.frontAxleKg + 30,
        rearAxleKg: p0.rearAxleKg + 90,
      },
      { preferStaticOnly: true },
    );
    expect(out.unaccountedLoad).toBeNull();
    expect(out.staticOffsets.gvmKg).toBeCloseTo(120, 0);
  });
});
