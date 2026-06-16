import { describe, it, expect } from 'vitest';
import { buildPhysicsInput } from '../build-physics-input';
import { INITIAL_STATE } from '../types';
import type { CalculatorState } from '../types';

const vehicle = {
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
  fuelTankCapacityL: 80,
  fuelType: 'DIESEL',
  model: { bodyType: 'UTE' },
};

const stateWithCalibration: CalculatorState = {
  ...INITIAL_STATE,
  customLoads: [
    { id: 'drawer', label: 'Drawer', massKg: 40, side: 'vehicle' },
    {
      id: 'resid',
      label: 'Unaccounted',
      massKg: 120,
      side: 'vehicle',
      cogXMm: 771,
      cogYMm: 0,
      isUnaccounted: true,
    },
  ],
  calibration: {
    measurement: { granularity: 'AXLE', frontAxleKg: 1210, rearAxleKg: 1690 },
    vehicleStaticOffsets: { frontAxleKg: 2, rearAxleKg: -2 },
    unaccountedLoadId: 'resid',
    notes: [],
  },
};

describe('buildPhysicsInput — calibration modes', () => {
  it('live mode includes the unaccounted load and the static offsets', () => {
    const input = buildPhysicsInput(stateWithCalibration, vehicle, null, 'live');
    // both custom loads present as vehicle accessories
    expect(input.vehicleAccessories).toHaveLength(2);
    expect(input.calibrationOverrides?.vehicleStaticOffsets).toEqual({
      frontAxleKg: 2,
      rearAxleKg: -2,
    });
  });

  it('baseline mode drops the unaccounted load and the offsets (clean C0)', () => {
    const input = buildPhysicsInput(
      stateWithCalibration,
      vehicle,
      null,
      'baseline',
    );
    // only the real drawer remains
    expect(input.vehicleAccessories).toHaveLength(1);
    expect(input.vehicleAccessories[0].installedWeightKg).toBe(40);
    expect(input.calibrationOverrides?.vehicleStaticOffsets).toBeUndefined();
  });

  it('carries caravanTareKg in both modes', () => {
    const s: CalculatorState = {
      ...stateWithCalibration,
      caravanAssumptions: { freshWaterL: 0, greyWaterL: 0, gearKg: 75 },
    };
    expect(
      buildPhysicsInput(s, vehicle, null, 'live').calibrationOverrides
        ?.caravanTareKg,
    ).toBe(75);
    expect(
      buildPhysicsInput(s, vehicle, null, 'baseline').calibrationOverrides
        ?.caravanTareKg,
    ).toBe(75);
  });
});

describe('buildPhysicsInput — P3 per-model correction', () => {
  const corrected = {
    ...vehicle,
    calibrationCorrection: {
      kerbMassDeltaKg: 45,
      kerbMassApplied: true,
      cogFractionDelta: 0.03,
      cogApplied: true,
    },
  };
  const noUserCalibration: CalculatorState = { ...INITIAL_STATE };

  it('folds a published correction into the live input when the user has not weighed', () => {
    const input = buildPhysicsInput(noUserCalibration, corrected, null, 'live');
    expect(input.calibrationOverrides?.vehicleKerbKg).toBe(45);
    expect(input.calibrationOverrides?.vehicleKerbCogFraction).toBeCloseTo(
      0.48,
      6,
    );
  });

  it('never applies the correction in baseline mode (no feedback onto P0)', () => {
    const input = buildPhysicsInput(
      noUserCalibration,
      corrected,
      null,
      'baseline',
    );
    expect(input.calibrationOverrides?.vehicleKerbKg).toBeUndefined();
    expect(input.calibrationOverrides?.vehicleKerbCogFraction).toBeUndefined();
  });

  it('the user’s own weighbridge calibration beats the crowd correction', () => {
    const input = buildPhysicsInput(stateWithCalibration, corrected, null, 'live');
    expect(input.calibrationOverrides?.vehicleKerbKg).toBeUndefined();
    expect(input.calibrationOverrides?.vehicleKerbCogFraction).toBeUndefined();
    // their own static offsets still apply
    expect(input.calibrationOverrides?.vehicleStaticOffsets).toBeDefined();
  });

  it('respects the CoG gate (kerbMass applies, CoG held back)', () => {
    const gated = {
      ...vehicle,
      calibrationCorrection: {
        kerbMassDeltaKg: 45,
        kerbMassApplied: true,
        cogFractionDelta: 0.03,
        cogApplied: false,
      },
    };
    const input = buildPhysicsInput(noUserCalibration, gated, null, 'live');
    expect(input.calibrationOverrides?.vehicleKerbKg).toBe(45);
    expect(input.calibrationOverrides?.vehicleKerbCogFraction).toBeUndefined();
  });
});
