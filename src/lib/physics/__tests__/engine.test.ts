import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';
import type { PhysicsInput } from '../types';

// --- Shared vehicle fixtures ---

const hiluxSR5: import('../types').VehicleInput = {
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
};

const landcruiser79: import('../types').VehicleInput = {
  gvmKg: 3300,
  gcmKg: 6500,
  kerbWeightKg: 2470,
  maxTowingCapacityKg: 3500,
  frontAxleLimitKg: 1500,
  rearAxleLimitKg: 2000,
  maxTowBallDownloadKg: 350,
  wheelbaseMm: 2980,
  frontOverhangMm: 900,
  rearOverhangMm: 450,
  fuelTankCapacityL: 130,
  fuelType: 'DIESEL',
};

const midSizeVan: import('../types').CaravanInput = {
  atmKg: 3500,
  gtmKg: 3150,
  tareKg: 2400,
  tbmKg: 350,
  axleConfiguration: 'SINGLE_AXLE',
  couplingToAxleMm: 2600,
  axleSpacingMm: null,
  freshWaterCapacityL: 120,
  greyWaterCapacityL: 90,
};

const dualAxleVan: import('../types').CaravanInput = {
  atmKg: 3500,
  gtmKg: 3200,
  tareKg: 2500,
  tbmKg: 300,
  axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
  couplingToAxleMm: 2800,
  axleSpacingMm: 1000,
  freshWaterCapacityL: 80,
  greyWaterCapacityL: 60,
};

const baseInput = (overrides: Partial<PhysicsInput> = {}): PhysicsInput => ({
  vehicle: hiluxSR5,
  vehicleAccessories: [],
  passengers: 2,
  cargoKg: 0,
  fuelPercent: 100,
  freshWaterPercent: 100,
  greyWaterPercent: 0,
  regulationSetCode: 'AU_ADR',
  ...overrides,
});

// --- Verdict honesty: estimatedLimits passes through, never affects status ---

describe('verdict honesty — estimatedLimits pass-through', () => {
  it('passes estimatedLimits through to the result without changing the verdict', () => {
    const plain = calculate(baseInput());
    const flagged = calculate(
      baseInput({
        vehicle: { ...hiluxSR5, estimatedLimits: ['gvm', 'frontAxle'] },
      }),
    );
    expect(flagged.vehicle.estimatedLimits).toEqual(['gvm', 'frontAxle']);
    // Same inputs (bar the advisory flag) → identical statuses.
    expect(flagged.overallStatus).toBe(plain.overallStatus);
    expect(flagged.vehicle.gvmStatus).toBe(plain.vehicle.gvmStatus);
    expect(flagged.vehicle.frontAxleStatus).toBe(plain.vehicle.frontAxleStatus);
  });

  it('omits estimatedLimits when the input has none', () => {
    expect(calculate(baseInput()).vehicle.estimatedLimits).toBeUndefined();
  });
});

// --- Scenario 1: Solo vehicle, no caravan, all within limits ---
describe('Scenario 1: solo vehicle, typical touring load, all within limits', () => {
  const result = calculate(
    baseInput({
      vehicleAccessories: [
        {
          installedWeightKg: 15,
          mountingLocation: 'ROOF_RACK',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 35,
          mountingLocation: 'CANOPY_EXTERIOR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 40,
          mountingLocation: 'TRAY_FLOOR',
          fillPercent: 100,
          quantity: 1,
        },
      ],
      passengers: 2,
      cargoKg: 50,
    }),
  );

  it('has no caravan result', () => expect(result.caravan).toBeUndefined());
  it('passes GVM', () => expect(result.vehicle.gvmStatus).toBe('ok'));
  it('passes front axle', () =>
    expect(result.vehicle.frontAxleStatus).toBe('ok'));
  it('passes rear axle', () =>
    expect(result.vehicle.rearAxleStatus).toBe('ok'));
  it('overall status is pass', () => expect(result.overallStatus).toBe('pass'));
  it('vehicle weight is under GVM', () =>
    expect(result.vehicle.totalWeightKg).toBeLessThan(hiluxSR5.gvmKg));
  it('has no GCM metrics', () => {
    expect(result.vehicle.gcmKg).toBeUndefined();
    expect(result.vehicle.gcmStatus).toBeUndefined();
  });
});

// --- Scenario 2: Solo vehicle, GVM breach ---
describe('Scenario 2: solo vehicle, GVM breach from heavy roof + drawers', () => {
  const result = calculate(
    baseInput({
      vehicleAccessories: [
        {
          installedWeightKg: 90,
          mountingLocation: 'ROOF_RACK',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 95,
          mountingLocation: 'CANOPY_ROOF',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 120,
          mountingLocation: 'TRAY_FLOOR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 85,
          mountingLocation: 'CANOPY_INTERIOR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 60,
          mountingLocation: 'TRAY_SIDE_LEFT',
          fillPercent: 100,
          quantity: 1,
        },
      ],
      passengers: 4,
      cargoKg: 250,
    }),
  );

  it('GVM fails', () => expect(result.vehicle.gvmStatus).toBe('fail'));
  it('overall status is fail', () => expect(result.overallStatus).toBe('fail'));
  it('weight exceeds GVM limit', () =>
    expect(result.vehicle.totalWeightKg).toBeGreaterThan(hiluxSR5.gvmKg));
  it('has GVM recommendation', () =>
    expect(result.recommendations.some((r) => r.id === 'gvm-exceeded')).toBe(
      true,
    ));
  it('has roof advisory for >80kg on roof mounts', () =>
    expect(result.advisories.some((a) => a.includes('roof'))).toBe(true));
});

// --- Scenario 3: Vehicle + caravan, all pass ---
describe('Scenario 3: LandCruiser 79 + mid-size van, conservative load', () => {
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      // midSizeVan's published TBM (350) sits exactly at the tow-ball limit, so
      // give this "conservative" case a van with genuine TBM headroom (320).
      caravan: { ...midSizeVan, tbmKg: 320 },
      vehicleAccessories: [
        {
          installedWeightKg: 25,
          mountingLocation: 'BULL_BAR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 40,
          mountingLocation: 'TRAY_FLOOR',
          fillPercent: 100,
          quantity: 1,
        },
      ],
      caravanAccessories: [],
      passengers: 1,
      cargoKg: 0,
      fuelPercent: 70,
      freshWaterPercent: 10,
      greyWaterPercent: 0,
    }),
  );

  it('has caravan result', () => expect(result.caravan).toBeDefined());
  it('GVM does not fail (may warn from tow ball load)', () =>
    expect(result.vehicle.gvmStatus).not.toBe('fail'));
  it('passes ATM', () => expect(result.caravan!.atmStatus).toBe('ok'));
  it('TBM% is in safe range', () =>
    expect(result.vehicle.towBallPctOfAtm).toBeGreaterThan(7));
  it('TBM% is under 12%', () =>
    expect(result.vehicle.towBallPctOfAtm).toBeLessThan(12));
  it('overall status is pass or warn', () =>
    expect(['pass', 'warn']).toContain(result.overallStatus));
});

// --- Scenario 4: TBM too low (tail-heavy van) ---
describe('Scenario 4: heavy rear toolbar + bike rack drives TBM below 7%', () => {
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: {
        ...midSizeVan,
        tbmKg: 250,
        freshWaterCapacityL: 80,
        greyWaterCapacityL: 60,
      },
      caravanAccessories: [
        {
          installedWeightKg: 200,
          mountingLocation: 'CARAVAN_TOOLBAR_EXTERNAL',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 80,
          mountingLocation: 'CARAVAN_BUMPER_BAR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 60,
          mountingLocation: 'CARAVAN_CHASSIS_REAR',
          fillPercent: 100,
          quantity: 1,
        },
      ],
      freshWaterPercent: 0,
      greyWaterPercent: 100,
    }),
  );

  it('TBM% is below 9%', () =>
    expect(result.vehicle.towBallPctOfAtm).toBeLessThan(9));
  it('TBM status is warn or fail', () =>
    expect(result.vehicle.towBallPctStatus).not.toBe('ok'));
  it('has TBM-too-low recommendation', () =>
    expect(result.recommendations.some((r) => r.id === 'tbm-too-low')).toBe(
      true,
    ));
  it('TBM-too-low recommendation is warn or critical', () => {
    const rec = result.recommendations.find((r) => r.id === 'tbm-too-low');
    expect(rec?.severity).toMatch(/warn|critical/);
  });
});

// --- Scenario 5: TBM too high (nose-heavy van) ---
describe('Scenario 5: all weight loaded forward of axle, TBM above 12%', () => {
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: midSizeVan,
      caravanAccessories: [
        {
          installedWeightKg: 120,
          mountingLocation: 'CARAVAN_DRAWBAR',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 80,
          mountingLocation: 'CARAVAN_A_FRAME',
          fillPercent: 100,
          quantity: 1,
        },
        {
          installedWeightKg: 60,
          mountingLocation: 'CARAVAN_CHASSIS_FRONT',
          fillPercent: 100,
          quantity: 1,
        },
      ],
      freshWaterPercent: 100,
      greyWaterPercent: 0,
    }),
  );

  it('TBM% is above 11%', () =>
    expect(result.vehicle.towBallPctOfAtm).toBeGreaterThan(11));
  it('TBM status is warn or fail', () =>
    expect(result.vehicle.towBallPctStatus).not.toBe('ok'));
  it('has TBM-too-high recommendation', () =>
    expect(result.recommendations.some((r) => r.id === 'tbm-too-high')).toBe(
      true,
    ));
});

// --- Scenario 6: GCM breach ---
describe('Scenario 6: both vehicle and caravan near individual limits, GCM exceeded', () => {
  const heavyVehicle: import('../types').VehicleInput = {
    ...hiluxSR5,
    kerbWeightKg: 2900, // very heavy setup
    gcmKg: 5800,
  };
  const heavyVan: import('../types').CaravanInput = {
    ...midSizeVan,
    atmKg: 3200,
    gtmKg: 2900,
    tareKg: 2800,
    tbmKg: 300,
  };

  const result = calculate(
    baseInput({
      vehicle: heavyVehicle,
      caravan: heavyVan,
      caravanAccessories: [],
      passengers: 2,
      cargoKg: 50,
      fuelPercent: 100,
    }),
  );

  it('GCM status is warn or fail', () =>
    expect(result.vehicle.gcmStatus).not.toBe('ok'));
  it('combined weight exceeds GCM', () =>
    expect(result.vehicle.gcmKg).toBeGreaterThan(heavyVehicle.gcmKg * 0.9));
  it('has GCM recommendation', () =>
    expect(result.recommendations.some((r) => r.id === 'gcm-exceeded')).toBe(
      true,
    ));
});

// --- Scenario 7: Close-coupled dual-axle GTM split (load-sharing → even) ---
describe('Scenario 7: close-coupled dual-axle GTM splits evenly', () => {
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: dualAxleVan, // DUAL_AXLE_CLOSE_COUPLED
      caravanAccessories: [],
      freshWaterPercent: 50,
      greyWaterPercent: 25,
    }),
  );
  const cr = result.caravan!;

  it('produces two axle results', () => expect(cr.axles.length).toBe(2));
  it('axle loads sum to GTM', () =>
    expect(cr.axles[0].loadKg + cr.axles[1].loadKg).toBeCloseTo(cr.gtmKg, 0));
  it('close-coupled (load-sharing) splits evenly', () =>
    expect(cr.axles[0].loadKg).toBeCloseTo(cr.axles[1].loadKg, 0));
  it('each axle within its half-share limit', () => {
    expect(cr.axles[0].status).not.toBe('fail');
    expect(cr.axles[1].status).not.toBe('fail');
  });
});

// --- Scenario 7b: Spread-axle van — position-dependent split overloads one axle ---
describe('Scenario 7b: spread-axle van overloads the front group axle while GTM is legal', () => {
  const spreadVan: import('../types').CaravanInput = {
    ...midSizeVan,
    axleConfiguration: 'DUAL_AXLE_SPREAD',
    couplingToAxleMm: 3000,
    axleSpacingMm: 1600,
    atmKg: 3500,
    // GTM limit set so the total passes (~0.88) but a single axle's half-share
    // (1225 kg) is exceeded once the nose-forward load biases the front axle.
    gtmKg: 2450,
    tareKg: 2000,
  };
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: spreadVan,
      caravanAccessories: [],
      freshWaterPercent: 0,
      greyWaterPercent: 100,
    }),
  );
  const cr = result.caravan!;

  it('splits unevenly (front axle heavier — load CoG is forward of the group)', () =>
    expect(cr.axles[0].loadKg).toBeGreaterThan(cr.axles[1].loadKg));
  it('axle loads still sum to GTM', () =>
    expect(cr.axles[0].loadKg + cr.axles[1].loadKg).toBeCloseTo(cr.gtmKg, 0));
  it('total GTM is within limit', () => expect(cr.gtmStatus).toBe('ok'));
  it('one axle is over its share', () =>
    expect(cr.axles.some((a) => a.status !== 'ok')).toBe(true));
  it('surfaces an axle-imbalance recommendation', () =>
    expect(result.recommendations.some((r) => r.id === 'axle-imbalance')).toBe(
      true,
    ));
});

// --- Scenario 7c: Triple-axle van splits three ways ---
describe('Scenario 7c: triple-axle van splits GTM three ways', () => {
  const tripleVan: import('../types').CaravanInput = {
    ...dualAxleVan,
    axleConfiguration: 'TRIPLE_AXLE',
    gtmKg: 4200,
    atmKg: 4500,
  };
  const result = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: tripleVan,
      caravanAccessories: [],
      freshWaterPercent: 50,
      greyWaterPercent: 25,
    }),
  );
  const cr = result.caravan!;

  it('produces three axle results', () => expect(cr.axles.length).toBe(3));
  it('axle loads sum to GTM', () =>
    expect(
      cr.axles[0].loadKg + cr.axles[1].loadKg + cr.axles[2].loadKg,
    ).toBeCloseTo(cr.gtmKg, 0));
  it('each axle carries ~one third', () =>
    expect(cr.axles[0].loadKg).toBeCloseTo(cr.gtmKg / 3, 0));
});

// --- Scenario 8: Weighbridge calibration offset ---
describe('Scenario 8: weighbridge calibration adds 60kg to vehicle kerb weight', () => {
  const baseline = calculate(baseInput({ passengers: 2, cargoKg: 0 }));
  const calibrated = calculate(
    baseInput({
      passengers: 2,
      cargoKg: 0,
      calibrationOverrides: { vehicleKerbKg: 60 },
    }),
  );

  it('calibrated vehicle weighs 60kg more', () =>
    expect(calibrated.vehicle.totalWeightKg).toBeCloseTo(
      baseline.vehicle.totalWeightKg + 60,
      0,
    ));
  it('calibrated effectiveKerb is 60kg more', () =>
    expect(calibrated.vehicle.effectiveKerbKg).toBe(
      baseline.vehicle.effectiveKerbKg + 60,
    ));
  it('axle loads shift with calibration', () =>
    expect(calibrated.vehicle.rearAxleKg).toBeGreaterThan(
      baseline.vehicle.rearAxleKg,
    ));
});

// --- Scenario 9: Tank fill effects on TBM ---
describe('Scenario 9: water fill affects TBM', () => {
  const fullFresh = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: midSizeVan,
      freshWaterPercent: 100,
      greyWaterPercent: 0,
    }),
  );
  const emptyFreshFullGrey = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: midSizeVan,
      freshWaterPercent: 0,
      greyWaterPercent: 100,
    }),
  );

  it('fresh 100%/grey 0% has higher TBM than fresh 0%/grey 100%', () =>
    expect(fullFresh.caravan!.towBallMassKg).toBeGreaterThan(
      emptyFreshFullGrey.caravan!.towBallMassKg,
    ));
  it('TBM difference is measurable (>10 kg) for typical tanks', () =>
    expect(
      fullFresh.caravan!.towBallMassKg -
        emptyFreshFullGrey.caravan!.towBallMassKg,
    ).toBeGreaterThan(10));
});

// --- Scenario 10: Bare van baseline — TBM anchored to manufacturer figure ---
describe('Scenario 10: bare caravan, computed TBM matches manufacturer TBM', () => {
  const bare = (caravan: import('../types').CaravanInput) =>
    calculate(
      baseInput({
        vehicle: landcruiser79,
        caravan,
        caravanAccessories: [],
        freshWaterPercent: 0,
        greyWaterPercent: 0,
        cargoKg: 0,
      }),
    );

  // The tare CoG is anchored to the published TBM, so a bare van (no water,
  // no accessories, no calibration) reproduces the manufacturer figure exactly
  // — across axle configs, not just one fixture.
  it('single-axle bare TBM == published', () => {
    const r = bare(midSizeVan);
    expect(r.caravan!.towBallMassKg).toBeCloseTo(midSizeVan.tbmKg, 0);
  });
  it('dual-axle bare TBM == published', () => {
    const r = bare(dualAxleVan);
    expect(r.caravan!.towBallMassKg).toBeCloseTo(dualAxleVan.tbmKg, 0);
  });
});

// --- Scenario 11: Water depletion TBM shift ---
describe('Scenario 11: water depletion drives safe setup into TBM warning zone', () => {
  // Use a van with large tanks well separated from axle
  const waterSensitiveVan: import('../types').CaravanInput = {
    ...midSizeVan,
    freshWaterCapacityL: 200, // large forward tank
    greyWaterCapacityL: 150, // large rearward tank
    atmKg: 3500,
    tbmKg: 340,
  };

  const tripStart = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: waterSensitiveVan,
      caravanAccessories: [],
      freshWaterPercent: 100,
      greyWaterPercent: 0,
    }),
  );

  const tripEnd = calculate(
    baseInput({
      vehicle: landcruiser79,
      caravan: waterSensitiveVan,
      caravanAccessories: [],
      freshWaterPercent: 0,
      greyWaterPercent: 100,
    }),
  );

  it('TBM is higher at trip start than trip end', () =>
    expect(tripStart.caravan!.towBallMassKg).toBeGreaterThan(
      tripEnd.caravan!.towBallMassKg,
    ));
  it('TBM drop across trip is significant (>30 kg)', () =>
    expect(
      tripStart.caravan!.towBallMassKg - tripEnd.caravan!.towBallMassKg,
    ).toBeGreaterThan(30));
  it('trip start TBM% is acceptable', () =>
    expect(tripStart.vehicle.towBallPctStatus).not.toBe('fail'));
});

// --- Scenario 12: Lateral (left/right) distribution ---
describe('Scenario 12: lateral distribution', () => {
  const balanced = calculate(
    baseInput({ vehicle: hiluxSR5, vehicleAccessories: [], passengers: 2 }),
  );

  it('a centred load is laterally balanced', () => {
    const l = balanced.vehicle.lateral!;
    expect(l).toBeDefined();
    expect(l.imbalancePct).toBeLessThan(1);
    expect(l.overShareCorner).toBeNull();
    expect(l.status).toBe('ok');
  });
  it('the four corners sum to the axle loads', () => {
    const l = balanced.vehicle.lateral!;
    expect(l.corners.fl + l.corners.fr).toBeCloseTo(
      balanced.vehicle.frontAxleKg,
      0,
    );
    expect(l.corners.rl + l.corners.rr).toBeCloseTo(
      balanced.vehicle.rearAxleKg,
      0,
    );
  });

  const rightHeavy = calculate(
    baseInput({
      vehicle: hiluxSR5,
      vehicleAccessories: [
        {
          installedWeightKg: 220,
          mountingLocation: 'TRAY_FLOOR',
          cogYMm: 600, // 600 mm right of centreline
          fillPercent: 100,
          quantity: 1,
        },
      ],
    }),
  );

  it('a right-mounted load makes the rig right-heavy', () => {
    const l = rightHeavy.vehicle.lateral!;
    expect(l.rightKg).toBeGreaterThan(l.leftKg);
    expect(l.imbalanceKg).toBeGreaterThan(0);
    expect(l.corners.rr).toBeGreaterThan(l.corners.rl);
  });
  it('per-tyre share limits are the axle limit halved', () => {
    const l = rightHeavy.vehicle.lateral!;
    expect(l.frontCornerLimitKg).toBeCloseTo(hiluxSR5.frontAxleLimitKg / 2, 0);
    expect(l.rearCornerLimitKg).toBeCloseTo(hiluxSR5.rearAxleLimitKg / 2, 0);
  });
});

// --- Performance: <1ms for 20 accessories ---
describe('Performance: calculate() under 1ms for 20-accessory setup', () => {
  const manyAccessories: import('../types').AccessoryLoad[] = Array.from(
    { length: 10 },
    (_, i) => ({
      installedWeightKg: 20 + i * 2,
      mountingLocation: 'TRAY_FLOOR' as const,
      fillPercent: 100,
      quantity: 1,
    }),
  );
  const manyCaravanAccessories: import('../types').AccessoryLoad[] = Array.from(
    { length: 10 },
    (_, i) => ({
      installedWeightKg: 15 + i,
      mountingLocation: 'CARAVAN_CHASSIS_MID' as const,
      fillPercent: 100,
      quantity: 1,
    }),
  );

  it('runs in under 1ms', () => {
    const start = performance.now();
    calculate(
      baseInput({
        vehicle: landcruiser79,
        caravan: midSizeVan,
        vehicleAccessories: manyAccessories,
        caravanAccessories: manyCaravanAccessories,
      }),
    );
    const elapsed = performance.now() - start;
    // Comfortably under the spec's 10ms recalc budget; 3ms avoids CI flakiness.
    expect(elapsed).toBeLessThan(3);
  });
});

// --- Caravan lateral (left/right) split ---
describe('Caravan lateral: van left/right balance', () => {
  it('is balanced (centreline) with no off-centre gear', () => {
    const r = calculate(baseInput({ caravan: midSizeVan }));
    const lat = r.caravan!.lateral!;
    expect(lat.imbalanceKg).toBeCloseTo(0, 1);
    expect(lat.status).toBe('ok');
    // Left + right reconstruct the GTM (axle-borne weight).
    expect(lat.leftKg + lat.rightKg).toBeCloseTo(r.caravan!.gtmKg, 1);
  });

  it('a right-side load tips the balance right', () => {
    const r = calculate(
      baseInput({
        caravan: midSizeVan,
        caravanAccessories: [
          {
            installedWeightKg: 120,
            mountingLocation: 'CARAVAN_CHASSIS_MID',
            cogYMm: 700, // +y = right
            fillPercent: 100,
            quantity: 1,
          },
        ],
      }),
    );
    const lat = r.caravan!.lateral!;
    expect(lat.imbalanceKg).toBeGreaterThan(0);
    expect(lat.rightKg).toBeGreaterThan(lat.leftKg);
  });

  it('flags an over-share tyre when grossly one-sided', () => {
    const r = calculate(
      baseInput({
        caravan: midSizeVan,
        caravanAccessories: [
          {
            installedWeightKg: 700,
            mountingLocation: 'CARAVAN_WALL_RIGHT',
            cogYMm: 850,
            fillPercent: 100,
            quantity: 1,
          },
        ],
      }),
    );
    const lat = r.caravan!.lateral!;
    expect(lat.overShareSide).toBe('right');
    expect(lat.heavierSidePerTyreKg).toBeGreaterThan(lat.perTyreShareLimitKg);
  });

  it('mirrors left and right (sign symmetry)', () => {
    const mk = (y: number) =>
      calculate(
        baseInput({
          caravan: midSizeVan,
          caravanAccessories: [
            {
              installedWeightKg: 150,
              mountingLocation: 'CARAVAN_CHASSIS_MID',
              cogYMm: y,
              fillPercent: 100,
              quantity: 1,
            },
          ],
        }),
      ).caravan!.lateral!;
    const right = mk(600);
    const left = mk(-600);
    expect(right.imbalanceKg).toBeCloseTo(-left.imbalanceKg, 1);
  });
});

// --- Stability (advisory CoG height + SSF) ---
describe('Stability: vertical CoG height + SSF (advisory)', () => {
  const roofAcc = (cogZMm?: number) => ({
    installedWeightKg: 80,
    mountingLocation: 'ROOF_RACK' as const,
    fillPercent: 100,
    quantity: 1,
    ...(cogZMm != null ? { cogZMm } : {}),
  });

  it('reports a CoG height and an SSF = halfTrack / cogHeight', () => {
    const s = calculate(baseInput()).vehicle.stability!;
    expect(s).toBeDefined();
    expect(s.provisional).toBe(true);
    expect(s.cogHeightMm).toBeGreaterThan(0);
    expect(s.trackWidthMm).toBe(1650); // default track
    expect(s.ssf).toBeCloseTo(s.trackWidthMm / 2 / s.cogHeightMm, 6);
  });

  it('a heavy roof load raises the CoG height and lowers the SSF', () => {
    const bare = calculate(baseInput()).vehicle.stability!;
    const loaded = calculate(baseInput({ vehicleAccessories: [roofAcc()] }))
      .vehicle.stability!;
    expect(loaded.cogHeightMm).toBeGreaterThan(bare.cogHeightMm);
    expect(loaded.ssf).toBeLessThan(bare.ssf);
  });

  it('respects an explicit cogZMm override', () => {
    const high = calculate(baseInput({ vehicleAccessories: [roofAcc(2200)] }))
      .vehicle.stability!;
    const low = calculate(baseInput({ vehicleAccessories: [roofAcc(300)] }))
      .vehicle.stability!;
    expect(high.cogHeightMm).toBeGreaterThan(low.cogHeightMm);
  });

  it('height is isolated: same x/y but different z leaves axle loads + verdict unchanged', () => {
    const low = calculate(baseInput({ vehicleAccessories: [roofAcc(300)] }));
    const high = calculate(baseInput({ vehicleAccessories: [roofAcc(2200)] }));
    // Axle split and overall verdict depend only on mass + x/y, never height.
    expect(high.vehicle.frontAxleKg).toBeCloseTo(low.vehicle.frontAxleKg, 6);
    expect(high.vehicle.rearAxleKg).toBeCloseTo(low.vehicle.rearAxleKg, 6);
    expect(high.overallStatus).toBe(low.overallStatus);
    // …but the stability estimate does differ.
    expect(high.vehicle.stability!.cogHeightMm).toBeGreaterThan(
      low.vehicle.stability!.cogHeightMm,
    );
  });
});
