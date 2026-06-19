import { describe, it, expect, afterEach } from 'vitest';
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
    const input = buildPhysicsInput(
      stateWithCalibration,
      vehicle,
      null,
      'live',
    );
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
    const input = buildPhysicsInput(
      stateWithCalibration,
      corrected,
      null,
      'live',
    );
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

describe('buildPhysicsInput — verdict honesty (estimated limits)', () => {
  it('a CATALOGUE / verified variant has no estimated limits', () => {
    const input = buildPhysicsInput(INITIAL_STATE, vehicle, null, 'live');
    expect(input.vehicle.estimatedLimits).toBeUndefined();
  });

  it('a COMMUNITY variant flags all compliance limits as estimated', () => {
    const community = { ...vehicle, status: 'COMMUNITY' };
    const input = buildPhysicsInput(INITIAL_STATE, community, null, 'live');
    expect(input.vehicle.estimatedLimits).toEqual(
      expect.arrayContaining(['gvm', 'gcm', 'frontAxle', 'rearAxle']),
    );
  });

  it('an "estimated" confidence badge also flags limits', () => {
    const est = { ...vehicle, confidenceBadge: 'estimated' };
    const input = buildPhysicsInput(INITIAL_STATE, est, null, 'live');
    expect(input.vehicle.estimatedLimits).toContain('gvm');
  });

  it('narrows to only the ESTIMATE/DISPUTED fields when provenance is present', () => {
    const withProvenance = {
      ...vehicle,
      // ROVER-confirmed GVM/tow; axle limits never published → still estimated.
      specProvenance: [
        { field: 'gvmKg', status: 'CONFIRMED' },
        { field: 'maxTowingCapacityKg', status: 'CONFIRMED' },
        { field: 'frontAxleLimitKg', status: 'ESTIMATE' },
        { field: 'rearAxleLimitKg', status: 'DISPUTED' },
        { field: 'kerbWeightKg', status: 'ESTIMATE' }, // not a compliance limit
      ],
    };
    const input = buildPhysicsInput(
      INITIAL_STATE,
      withProvenance,
      null,
      'live',
    );
    expect(input.vehicle.estimatedLimits).toEqual(['frontAxle', 'rearAxle']);
  });

  it('returns undefined when every provenance field is CONFIRMED', () => {
    const allConfirmed = {
      ...vehicle,
      status: 'COMMUNITY', // provenance wins over the legacy variant signal
      specProvenance: [
        { field: 'gvmKg', status: 'CONFIRMED' },
        { field: 'frontAxleLimitKg', status: 'CONFIRMED' },
      ],
    };
    const input = buildPhysicsInput(INITIAL_STATE, allConfirmed, null, 'live');
    expect(input.vehicle.estimatedLimits).toBeUndefined();
  });
});

describe('buildPhysicsInput — GVM-upgrade overlay (gated, advisory)', () => {
  afterEach(() => {
    delete process.env.GVM_UPGRADE_ENABLED;
  });

  // A certified GVM upgrade: lifts GVM + axle limits, adds spring mass, but
  // does NOT state GCM (the headroom trap) — GCM must stay at the factory value.
  const upgradedVehicle = {
    ...vehicle,
    appliedGvmUpgrade: {
      gvmKg: 3700,
      frontAxleLimitKg: 1600,
      rearAxleLimitKg: 2100,
      addedMassKg: 20,
      // gcmKg + maxTowingKg deliberately absent → keep factory.
    },
  };

  it('flag OFF: the overlay is ignored — factory limits + no added mass', () => {
    const input = buildPhysicsInput(INITIAL_STATE, upgradedVehicle, null);
    expect(input.vehicle.gvmKg).toBe(3200);
    expect(input.vehicle.frontAxleLimitKg).toBe(1500);
    expect(input.vehicle.rearAxleLimitKg).toBe(1850);
    expect(input.vehicleAccessories).toHaveLength(0);
  });

  it('flag ON: raises GVM + the stated axle limits', () => {
    process.env.GVM_UPGRADE_ENABLED = 'true';
    const input = buildPhysicsInput(INITIAL_STATE, upgradedVehicle, null);
    expect(input.vehicle.gvmKg).toBe(3700);
    expect(input.vehicle.frontAxleLimitKg).toBe(1600);
    expect(input.vehicle.rearAxleLimitKg).toBe(2100);
  });

  it('flag ON: GCM not stated by the upgrade stays at the factory value', () => {
    process.env.GVM_UPGRADE_ENABLED = 'true';
    const input = buildPhysicsInput(INITIAL_STATE, upgradedVehicle, null);
    expect(input.vehicle.gcmKg).toBe(6000);
    expect(input.vehicle.maxTowingCapacityKg).toBe(3500);
  });

  it('flag ON: applies the added kit mass as a placed vehicle load', () => {
    process.env.GVM_UPGRADE_ENABLED = 'true';
    const input = buildPhysicsInput(INITIAL_STATE, upgradedVehicle, null);
    expect(input.vehicleAccessories).toHaveLength(1);
    expect(input.vehicleAccessories[0].installedWeightKg).toBe(20);
    expect(input.vehicleAccessories[0].mountingLocation).toBe('CHASSIS_MID');
  });

  it('flag ON: a custom (plate-path) overlay is applied like a kit', () => {
    process.env.GVM_UPGRADE_ENABLED = 'true';
    const custom = {
      ...vehicle,
      customGvmUpgrade: { gvmKg: 3500, gcmKg: 6300, addedMassKg: 18 },
    };
    const input = buildPhysicsInput(INITIAL_STATE, custom, null);
    expect(input.vehicle.gvmKg).toBe(3500);
    expect(input.vehicle.gcmKg).toBe(6300);
    expect(input.vehicleAccessories[0].installedWeightKg).toBe(18);
  });
});
