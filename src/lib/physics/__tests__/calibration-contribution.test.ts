import { describe, it, expect } from 'vitest';
import {
  deriveContribution,
  measuredTotalKg,
  weightedMedian,
  aggregateCorrection,
  mergeModelCorrection,
  MIN_SAMPLES,
  type DerivedContribution,
  type ModelCorrection,
} from '../calibration-contribution';
import { calculate, VEHICLE_KERB_COG_FRACTION } from '../engine';
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

describe('measuredTotalKg', () => {
  it('reads the total for each granularity', () => {
    expect(measuredTotalKg({ granularity: 'TOTAL', totalKg: 3000 })).toBe(3000);
    expect(
      measuredTotalKg({ granularity: 'AXLE', frontAxleKg: 1200, rearAxleKg: 1800 }),
    ).toBe(3000);
    expect(
      measuredTotalKg({
        granularity: 'CORNER',
        corners: { fl: 600, fr: 600, rl: 900, rr: 900 },
      }),
    ).toBe(3000);
  });

  it('returns null when the granularity fields are missing or tow-ball only', () => {
    expect(measuredTotalKg({ granularity: 'AXLE', frontAxleKg: 1200 })).toBeNull();
    expect(measuredTotalKg({ granularity: 'TOWBALL', towBallKg: 300 })).toBeNull();
  });
});

describe('deriveContribution', () => {
  const p0 = calculate(baseInput).vehicle;

  it('TOTAL ticket: residual = measured − model; no CoG signal without an axle split', () => {
    const measured = p0.totalWeightKg + 120;
    const d = deriveContribution(baseInput, {
      granularity: 'TOTAL',
      totalKg: measured,
    })!;
    expect(d).not.toBeNull();
    expect(d.residualMassKg).toBeCloseTo(120, 1);
    expect(d.kerbMassDeltaKg).toBeCloseTo(120, 1);
    expect(d.cogFractionDelta).toBeNull();
    // bareness = kerb / measured
    expect(d.barenessWeight).toBeCloseTo(2160 / measured, 4);
  });

  it('AXLE ticket equal to the model: zero residual, zero CoG shift', () => {
    const d = deriveContribution(baseInput, {
      granularity: 'AXLE',
      frontAxleKg: p0.frontAxleKg,
      rearAxleKg: p0.rearAxleKg,
    })!;
    expect(d.residualMassKg).toBeCloseTo(0, 1);
    expect(d.cogFractionDelta).toBeCloseTo(0, 4);
  });

  it('weight shifted rearward (total unchanged) → negative CoG-fraction delta', () => {
    // Move 50 kg from front to rear; residual stays 0, base mass stays kerb,
    // so the implied fraction drops by 50/kerb.
    const d = deriveContribution(baseInput, {
      granularity: 'AXLE',
      frontAxleKg: p0.frontAxleKg - 50,
      rearAxleKg: p0.rearAxleKg + 50,
    })!;
    expect(d.residualMassKg).toBeCloseTo(0, 1);
    expect(d.cogFractionDelta).toBeCloseTo(-50 / 2160, 4);
  });

  it('CORNER ticket folds corners into an axle split for the CoG signal', () => {
    const half = (kg: number) => kg / 2;
    const d = deriveContribution(baseInput, {
      granularity: 'CORNER',
      corners: {
        fl: half(p0.frontAxleKg),
        fr: half(p0.frontAxleKg),
        rl: half(p0.rearAxleKg),
        rr: half(p0.rearAxleKg),
      },
    })!;
    expect(d.cogFractionDelta).toBeCloseTo(0, 4);
  });

  it('rejects an implausible ticket (likely a data-entry error)', () => {
    expect(
      deriveContribution(baseInput, {
        granularity: 'TOTAL',
        totalKg: p0.totalWeightKg * 5,
      }),
    ).toBeNull();
  });

  it('drops an implausible CoG shift while keeping the kerb-mass signal', () => {
    // Nearly all weight on the front axle → an absurd implied base-CoG fraction.
    const d = deriveContribution(baseInput, {
      granularity: 'AXLE',
      frontAxleKg: 2000,
      rearAxleKg: 200,
    })!;
    expect(d).not.toBeNull();
    expect(d.cogFractionDelta).toBeNull(); // beyond the sane band → discarded
    expect(Number.isFinite(d.kerbMassDeltaKg)).toBe(true); // mass signal survives
  });

  it('rejects an incomplete snapshot whose prediction is non-finite (no NaN rows)', () => {
    // Vehicle stripped to kerb + wheelbase (what a non-loose zod object yields)
    // but the arrays/scalars intact — the engine then reads NaN from the missing
    // gvm/limits. The derivation must drop it, not store a NaN row.
    const stripped = {
      ...baseInput,
      vehicle: { kerbWeightKg: 2160, wheelbaseMm: 3085 },
    } as unknown as PhysicsInput;
    expect(
      deriveContribution(stripped, { granularity: 'TOTAL', totalKg: 2200 }),
    ).toBeNull();
  });
});

describe('weightedMedian', () => {
  it('returns the value where cumulative weight crosses half', () => {
    expect(
      weightedMedian([
        { value: 10, weight: 1 },
        { value: 20, weight: 1 },
        { value: 30, weight: 1 },
      ]),
    ).toBe(20);
  });

  it('lets weight pull the median toward the heavier samples', () => {
    // A heavy near-kerb sample at 40 outweighs two light loaded ones at 10.
    expect(
      weightedMedian([
        { value: 10, weight: 0.2 },
        { value: 10, weight: 0.2 },
        { value: 40, weight: 0.9 },
      ]),
    ).toBe(40);
  });

  it('ignores zero/negative weights and non-finite values', () => {
    expect(
      weightedMedian([
        { value: 5, weight: 0 },
        { value: 99, weight: 1 },
      ]),
    ).toBe(99);
    expect(weightedMedian([])).toBeNull();
  });
});

describe('aggregateCorrection', () => {
  const row = (over: Partial<DerivedContribution>): DerivedContribution => ({
    measuredTotalKg: 2200,
    predictedTotalKg: 2160,
    residualMassKg: 40,
    barenessWeight: 0.95,
    kerbMassDeltaKg: 40,
    cogFractionDelta: 0.02,
    ...over,
  });

  it('publishes nothing below the min-sample gate', () => {
    const agg = aggregateCorrection([row({}), row({})]); // 2 < MIN_SAMPLES (3)
    expect(agg.kerbMassDeltaKg).toBeNull();
    expect(agg.cogFractionDelta).toBeNull();
    expect(agg.kerbMassSampleCount).toBe(2);
  });

  it('publishes a robust median once the gate is met', () => {
    const rows = [
      row({ kerbMassDeltaKg: 35, cogFractionDelta: 0.01 }),
      row({ kerbMassDeltaKg: 40, cogFractionDelta: 0.02 }),
      row({ kerbMassDeltaKg: 45, cogFractionDelta: 0.03 }),
    ];
    const agg = aggregateCorrection(rows);
    expect(agg.kerbMassSampleCount).toBe(3);
    expect(agg.kerbMassDeltaKg).toBe(40);
    expect(agg.cogFractionDelta).toBe(0.02);
  });

  it('counts the CoG signal only from rows that carry one', () => {
    const rows = [
      row({ cogFractionDelta: null }),
      row({ cogFractionDelta: 0.02 }),
      row({ cogFractionDelta: 0.02 }),
      row({ cogFractionDelta: 0.02 }),
    ];
    const agg = aggregateCorrection(rows);
    expect(agg.kerbMassSampleCount).toBe(4);
    expect(agg.cogSampleCount).toBe(3);
    expect(agg.cogFractionDelta).toBe(0.02);
  });

  it('drops zero-bareness rows from the pool', () => {
    const rows = [
      row({ barenessWeight: 0 }),
      row({ barenessWeight: 0 }),
      row({ barenessWeight: 0 }),
    ];
    const agg = aggregateCorrection(rows);
    expect(agg.kerbMassSampleCount).toBe(0);
    expect(agg.kerbMassDeltaKg).toBeNull();
  });

  it('MIN_SAMPLES is the documented gate', () => {
    expect(MIN_SAMPLES).toBe(3);
  });
});

describe('mergeModelCorrection', () => {
  const full: ModelCorrection = {
    kerbMassDeltaKg: 40,
    kerbMassApplied: true,
    cogFractionDelta: 0.03,
    cogApplied: true,
  };

  it('applies kerb-mass when flagged', () => {
    const out = mergeModelCorrection(undefined, {
      ...full,
      cogApplied: false,
    });
    expect(out?.vehicleKerbKg).toBe(40);
    expect(out?.vehicleKerbCogFraction).toBeUndefined();
  });

  it('applies the CoG fraction only when the gate is open', () => {
    const gated = mergeModelCorrection(undefined, {
      ...full,
      cogApplied: false,
    });
    expect(gated?.vehicleKerbCogFraction).toBeUndefined();

    const opened = mergeModelCorrection(undefined, full);
    expect(opened?.vehicleKerbCogFraction).toBeCloseTo(
      VEHICLE_KERB_COG_FRACTION + 0.03,
      6,
    );
  });

  it('never clobbers the user’s own calibration', () => {
    const out = mergeModelCorrection(
      { vehicleKerbKg: 999, vehicleKerbCogFraction: 0.5 },
      full,
    );
    expect(out?.vehicleKerbKg).toBe(999);
    expect(out?.vehicleKerbCogFraction).toBe(0.5);
  });

  it('passes the base through when there is no correction', () => {
    expect(mergeModelCorrection({ caravanTareKg: 10 }, null)).toEqual({
      caravanTareKg: 10,
    });
  });

  it('the engine honours an injected CoG fraction (rear shift lightens the front axle)', () => {
    const baseline = calculate(baseInput).vehicle;
    const shifted = calculate({
      ...baseInput,
      calibrationOverrides: { vehicleKerbCogFraction: 0.4 }, // CoG further rearward
    }).vehicle;
    // Kerb mass moved toward the rear axle → less on the front.
    expect(shifted.frontAxleKg).toBeLessThan(baseline.frontAxleKg);
    expect(shifted.totalWeightKg).toBeCloseTo(baseline.totalWeightKg, 4);
  });
});
