import { describe, it, expect } from 'vitest';
import { calculate } from '@/lib/physics/engine';
import type { PhysicsInput } from '@/lib/physics/types';
import { buildSchematicModel, locationLabel } from '../model';

const vehicle: PhysicsInput['vehicle'] = {
  gvmKg: 3350,
  gcmKg: 6350,
  kerbWeightKg: 2115,
  maxTowingCapacityKg: 3500,
  frontAxleLimitKg: 1450,
  rearAxleLimitKg: 1700,
  maxTowBallDownloadKg: 350,
  wheelbaseMm: 3085,
  frontOverhangMm: 935,
  rearOverhangMm: 1280,
  fuelTankCapacityL: 80,
  fuelType: 'DIESEL',
};

const caravan: PhysicsInput['caravan'] = {
  atmKg: 3300,
  gtmKg: 3000,
  tareKg: 2460,
  tbmKg: 300,
  axleConfiguration: 'DUAL_AXLE_CLOSE_COUPLED',
  couplingToAxleMm: 5200,
  axleSpacingMm: 1000,
  freshWaterCapacityL: 120,
  greyWaterCapacityL: 90,
};

const result = calculate({
  vehicle,
  caravan,
  vehicleAccessories: [
    {
      installedWeightKg: 60,
      mountingLocation: 'BULL_BAR',
      fillPercent: 100,
      quantity: 1,
    },
  ],
  caravanAccessories: [
    {
      installedWeightKg: 90,
      mountingLocation: 'CARAVAN_TOOLBAR_EXTERNAL',
      fillPercent: 100,
      quantity: 1,
    },
  ],
  passengers: 2,
  cargoKg: 50,
  fuelPercent: 100,
  freshWaterPercent: 50,
  greyWaterPercent: 0,
  regulationSetCode: 'AU_ADR',
});

function build() {
  return buildSchematicModel({
    title: 'Toyota HiLux SR5 + Jayco Silverline',
    vehicle: {
      wheelbaseMm: vehicle.wheelbaseMm,
      frontOverhangMm: vehicle.frontOverhangMm,
      rearOverhangMm: vehicle.rearOverhangMm,
      bodyType: 'DUAL_CAB_UTE',
    },
    caravan: {
      couplingToAxleMm: caravan!.couplingToAxleMm,
      axleSpacingMm: caravan!.axleSpacingMm,
      bodyLengthMm: 6600,
      overallLengthMm: 9400,
      axleConfiguration: caravan!.axleConfiguration,
      bodyType: 'CARAVAN_FULL_HEIGHT',
    },
    vehicleAccessories: [
      { id: 'a1', weightKg: 60, mountingLocation: 'BULL_BAR' },
    ],
    caravanAccessories: [
      { id: 'c1', weightKg: 90, mountingLocation: 'CARAVAN_TOOLBAR_EXTERNAL' },
    ],
    result,
  });
}

describe('buildSchematicModel', () => {
  it('returns null without wheelbase', () => {
    expect(
      buildSchematicModel({
        title: 't',
        vehicle: { wheelbaseMm: 0 },
        vehicleAccessories: [],
        caravanAccessories: [],
        result,
      }),
    ).toBeNull();
  });

  it('places the front axle ahead (right) of the rear axle', () => {
    const m = build()!;
    expect(m.vehicle.frontAxleMm).toBeGreaterThan(m.vehicle.rearAxleMm);
    expect(m.vehicle.frontBumperMm).toBeGreaterThan(m.vehicle.frontAxleMm);
  });

  it('trails the caravan to the left of the tow hitch', () => {
    const m = build()!;
    expect(m.caravan).toBeDefined();
    // every caravan axle and the van body sit to the LEFT (smaller x) of the coupling
    for (const ax of m.caravan!.axleMms)
      expect(ax).toBeLessThan(m.caravan!.couplingMm);
    expect(m.caravan!.bodyRearMm).toBeLessThan(m.caravan!.couplingMm);
  });

  it('renders two axle gauges for a dual-axle van plus the two vehicle axles', () => {
    const m = build()!;
    const ids = m.axles.map((a) => a.id);
    expect(ids).toContain('front');
    expect(ids).toContain('rear');
    expect(ids.filter((i) => i.startsWith('caravan-')).length).toBe(2);
  });

  it('positions a bull bar ahead of the front axle and a rear toolbar behind the van axle', () => {
    const m = build()!;
    const bull = m.dots.find((d) => d.label.toLowerCase().includes('bull'))!;
    expect(bull.xMm).toBeGreaterThan(m.vehicle.frontAxleMm);

    const toolbar = m.dots.find((d) => d.side === 'caravan')!;
    const rearmostVanAxle = Math.min(...m.caravan!.axleMms);
    expect(toolbar.xMm).toBeLessThan(rearmostVanAxle);
  });

  it('numbers dots sequentially and carries the gauge status from the engine', () => {
    const m = build()!;
    expect(m.dots.map((d) => d.n)).toEqual([1, 2]);
    const rear = m.axles.find((a) => a.id === 'rear')!;
    expect(rear.status).toBe(result.vehicle.rearAxleStatus);
  });

  it('locationLabel humanises enum values', () => {
    expect(locationLabel('CARAVAN_TOOLBAR_EXTERNAL')).toBe('Toolbar External');
    expect(locationLabel('BULL_BAR')).toBe('Bull Bar');
  });
});
