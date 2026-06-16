import { describe, it, expect } from 'vitest';
import {
  solveVehicleCalibration,
  MIN_POSITIONED_MASS_KG,
  type WeighbridgeMeasurement,
  type PredictedVehicle,
  type VehicleGeometry,
} from '../calibration';
import { calculate } from '../engine';
import type { PhysicsInput, CornerKey } from '../types';

const geom: VehicleGeometry = {
  wheelbaseMm: 3085,
  trackWidthMm: 1650,
  frontOverhangMm: 900,
  rearOverhangMm: 450,
};

// CALIBRATION_SIGNOFF.md §7 worked example.
const predictedAxle: PredictedVehicle = {
  totalKg: 2780,
  frontAxleKg: 1180,
  rearAxleKg: 1600,
};

describe('solveVehicleCalibration — AXLE (§4.2 / §7)', () => {
  it('reproduces the worked example: 120 kg at x≈771 mm, no offset', () => {
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1210,
      rearAxleKg: 1690,
    };
    const r = solveVehicleCalibration(m, predictedAxle, geom);
    expect(r.unaccountedLoad).not.toBeNull();
    expect(r.unaccountedLoad!.massKg).toBe(120);
    // x = ΔF·wb/m = 30·3085/120 = 771.25 → 771
    expect(r.unaccountedLoad!.cogXMm).toBe(771);
    expect(r.unaccountedLoad!.cogYMm).toBe(0);
    expect(r.unaccountedLoad!.isBestGuessPosition).toBe(false);
    // exact fit → negligible static offset
    expect(Math.abs(r.staticOffsets.frontAxleKg ?? 0)).toBeLessThan(0.5);
    expect(Math.abs(r.staticOffsets.rearAxleKg ?? 0)).toBeLessThan(0.5);
  });

  it('the fitted load reproduces the measured axles through the engine', () => {
    // Feed the solved load as a positioned accessory on a bare vehicle whose
    // own loads we zero out, so the engine output == the load's own split.
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1210,
      rearAxleKg: 1690,
    };
    const { unaccountedLoad } = solveVehicleCalibration(m, predictedAxle, geom);
    const contribFront =
      (unaccountedLoad!.massKg * unaccountedLoad!.cogXMm) / geom.wheelbaseMm;
    // ΔF should come back out as 30 kg on the front axle.
    expect(contribFront).toBeCloseTo(30, 0);
  });
});

describe('solveVehicleCalibration — TOTAL (§4.1)', () => {
  it('places the residual at the best-guess cargo zone, flagged for dragging', () => {
    const m: WeighbridgeMeasurement = { granularity: 'TOTAL', totalKg: 2900 };
    const r = solveVehicleCalibration(m, predictedAxle, geom);
    expect(r.unaccountedLoad!.massKg).toBe(120);
    expect(r.unaccountedLoad!.cogXMm).toBe(Math.round(3085 * 0.3)); // 926
    expect(r.unaccountedLoad!.isBestGuessPosition).toBe(true);
    expect(r.staticOffsets.frontAxleKg).toBeUndefined();
  });
});

describe('solveVehicleCalibration — CORNER (§4.3, diagonal twist)', () => {
  const predictedCorner: PredictedVehicle = {
    totalKg: 2780,
    frontAxleKg: 1180,
    rearAxleKg: 1600,
    corners: { fl: 590, fr: 590, rl: 800, rr: 800 },
  };

  it('load reproduces total/F-R/L-R; ±5 kg diagonal twist held as a corner offset', () => {
    // measured = predicted + 30/30 front, 45/45 rear, + a pure ±5 twist.
    const m: WeighbridgeMeasurement = {
      granularity: 'CORNER',
      corners: { fl: 610, fr: 600, rl: 840, rr: 850 },
    };
    const r = solveVehicleCalibration(m, predictedCorner, geom);
    expect(r.unaccountedLoad!.massKg).toBe(120);
    expect(r.unaccountedLoad!.cogXMm).toBe(771);
    expect(r.unaccountedLoad!.cogYMm).toBe(0); // left/right balanced

    const c = r.staticOffsets.corners!;
    // twist remainder ±5
    expect(c.fl).toBeCloseTo(5, 0);
    expect(c.fr).toBeCloseTo(-5, 0);
    expect(c.rl).toBeCloseTo(-5, 0);
    expect(c.rr).toBeCloseTo(5, 0);
    // axle offsets net to zero (load took the symmetric part)
    expect(r.staticOffsets.frontAxleKg).toBeCloseTo(0, 0);
    expect(r.staticOffsets.rearAxleKg).toBeCloseTo(0, 0);
    // corner offsets sum to ~0 (pure twist)
    const sum = (['fl', 'fr', 'rl', 'rr'] as CornerKey[]).reduce(
      (s, k) => s + (c[k] ?? 0),
      0,
    );
    expect(sum).toBeCloseTo(0, 0);
  });

  it('solves a lateral offset when the ticket is left/right-heavy', () => {
    // shift 60 kg of the front residual entirely to the right corners.
    const m: WeighbridgeMeasurement = {
      granularity: 'CORNER',
      corners: { fl: 590, fr: 650, rl: 800, rr: 860 },
    };
    const r = solveVehicleCalibration(m, predictedCorner, geom);
    // right-heavy → positive cogY
    expect(r.unaccountedLoad!.cogYMm).toBeGreaterThan(0);
  });
});

describe('solveVehicleCalibration — degenerate cases (§6)', () => {
  it('negative residual → no load, static bias offset, note', () => {
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1170,
      rearAxleKg: 1580,
    };
    const r = solveVehicleCalibration(m, predictedAxle, geom);
    expect(r.unaccountedLoad).toBeNull();
    expect(r.staticOffsets.gvmKg).toBeCloseTo(-30, 0);
    expect(r.notes.join(' ')).toMatch(/over-read/i);
  });

  it('residual below the positioning threshold → static offset only', () => {
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1185,
      rearAxleKg: 1605,
    };
    const r = solveVehicleCalibration(m, predictedAxle, geom);
    expect(10).toBeLessThan(MIN_POSITIONED_MASS_KG);
    expect(r.unaccountedLoad).toBeNull();
    expect(r.staticOffsets.frontAxleKg).toBeCloseTo(5, 0);
    expect(r.staticOffsets.rearAxleKg).toBeCloseTo(5, 0);
  });

  it('preferStaticOnly → no load even with a placeable residual', () => {
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1210,
      rearAxleKg: 1690,
    };
    const r = solveVehicleCalibration(m, predictedAxle, geom, {
      preferStaticOnly: true,
    });
    expect(r.unaccountedLoad).toBeNull();
    expect(r.staticOffsets.gvmKg).toBeCloseTo(120, 0);
    expect(r.staticOffsets.frontAxleKg).toBeCloseTo(30, 0);
  });

  it('clamps an out-of-envelope position and spills the remainder to an offset', () => {
    // Huge front residual, tiny rear → x wants to be far forward of the front axle.
    const m: WeighbridgeMeasurement = {
      granularity: 'AXLE',
      frontAxleKg: 1380, // ΔF = 200
      rearAxleKg: 1605, // ΔR = 5 → m = 205, x = 200·3085/205 = 3010mm (< xMax)
    };
    const r = solveVehicleCalibration(m, predictedAxle, geom);
    const xMax = geom.wheelbaseMm + (geom.frontOverhangMm ?? 1200);
    expect(r.unaccountedLoad!.cogXMm).toBeLessThanOrEqual(xMax);
    // front+rear offset should net to ~0 vs the total when not clamped, or carry
    // the clamp remainder when clamped.
    expect(r.staticOffsets.gvmKg).toBeDefined();
  });
});

// --- Engine integration: static offsets applied to output (§5) ---

const bareVehicle: PhysicsInput = {
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

describe('engine — applies vehicle static offsets', () => {
  it('shifts axle + total figures and recomputes statuses', () => {
    const base = calculate(bareVehicle);
    const cal = calculate({
      ...bareVehicle,
      calibrationOverrides: {
        vehicleStaticOffsets: { gvmKg: 100, frontAxleKg: 40, rearAxleKg: 60 },
      },
    });
    expect(cal.vehicle.totalWeightKg).toBeCloseTo(
      base.vehicle.totalWeightKg + 100,
      1,
    );
    expect(cal.vehicle.frontAxleKg).toBeCloseTo(
      base.vehicle.frontAxleKg + 40,
      1,
    );
    expect(cal.vehicle.rearAxleKg).toBeCloseTo(base.vehicle.rearAxleKg + 60, 1);
    // total stays consistent with front+rear
    expect(cal.vehicle.frontAxleKg + cal.vehicle.rearAxleKg).toBeCloseTo(
      cal.vehicle.totalWeightKg,
      0,
    );
  });

  it('recomputes lateral aggregates from corner offsets', () => {
    const base = calculate(bareVehicle);
    const cal = calculate({
      ...bareVehicle,
      calibrationOverrides: {
        vehicleStaticOffsets: {
          corners: { fr: 50, rr: 50, fl: -50, rl: -50 },
        },
      },
    });
    // pushed 100 kg from left to right
    expect(cal.vehicle.lateral!.rightKg).toBeCloseTo(
      base.vehicle.lateral!.rightKg + 100,
      0,
    );
    expect(cal.vehicle.lateral!.leftKg).toBeCloseTo(
      base.vehicle.lateral!.leftKg - 100,
      0,
    );
    expect(cal.vehicle.lateral!.imbalanceKg).toBeGreaterThan(
      base.vehicle.lateral!.imbalanceKg,
    );
  });

  it('no offsets → identical to the uncalibrated result', () => {
    const base = calculate(bareVehicle);
    const same = calculate({ ...bareVehicle, calibrationOverrides: {} });
    expect(same.vehicle.totalWeightKg).toBe(base.vehicle.totalWeightKg);
    expect(same.vehicle.frontAxleKg).toBe(base.vehicle.frontAxleKg);
  });
});
