import { describe, it, expect } from 'vitest';
import { setupToCalculatorState, type SetupDTO } from '../setup-to-state';

const baseSetup: SetupDTO = {
  vehicleVariantId: 'veh-1',
  caravanVariantId: null,
  passengers: 3,
  cargoKg: '120',
  fuelPercent: 80,
  freshWaterPercent: 50,
  greyWaterPercent: 10,
  accessories: [
    {
      fitmentId: 'fit-1',
      cogXMmOverride: 500,
      cogYMmOverride: -100,
      fitment: {
        installedWeightKg: '45',
        mountingLocation: 'TUB_INTERIOR',
        accessory: { name: 'Drawer system', topDownImageUrl: null },
      },
    },
  ],
  caravanAccessories: [],
  customLoads: [
    {
      id: 'cl-real',
      label: 'Firewood',
      weightKg: '20',
      side: 'CARAVAN',
      cogXMm: 100,
      cogYMm: 0,
    },
    {
      id: 'cl-resid',
      label: 'Unaccounted (weighbridge)',
      weightKg: '120',
      side: 'VEHICLE',
      cogXMm: 771,
      cogYMm: 0,
      isUnaccounted: true,
    },
  ],
  calibrationOverrides: {
    weighbridge: {
      measurement: { granularity: 'AXLE', frontAxleKg: 1210, rearAxleKg: 1690 },
      vehicleStaticOffsets: { frontAxleKg: 0, rearAxleKg: 0 },
      unaccountedLoadId: 'stale-client-id',
      notes: ['axle ticket reproduced'],
    },
  },
};

describe('setupToCalculatorState', () => {
  it('maps journey + accessories with fitmentId as accessoryId', () => {
    const s = setupToCalculatorState(baseSetup);
    expect(s.vehicleVariantId).toBe('veh-1');
    expect(s.journey.passengers).toBe(3);
    expect(s.journey.cargoKg).toBe(120);
    expect(s.journey.fuelPercent).toBe(80);
    expect(s.accessories).toHaveLength(1);
    expect(s.accessories[0]).toMatchObject({
      accessoryId: 'fit-1',
      massKg: 45,
      mountingLocation: 'TUB_INTERIOR',
      label: 'Drawer system',
      cogXMm: 500,
      cogYMm: -100,
    });
  });

  it('maps custom loads incl. side + isUnaccounted', () => {
    const s = setupToCalculatorState(baseSetup);
    expect(s.customLoads).toHaveLength(2);
    const fire = s.customLoads.find((l) => l.label === 'Firewood')!;
    expect(fire.side).toBe('caravan');
    expect(fire.massKg).toBe(20);
    const resid = s.customLoads.find((l) => l.isUnaccounted)!;
    expect(resid.side).toBe('vehicle');
    expect(resid.massKg).toBe(120);
  });

  it('restores calibration and re-links unaccountedLoadId to the rebuilt load', () => {
    const s = setupToCalculatorState(baseSetup);
    expect(s.calibration).not.toBeNull();
    expect(s.calibration!.measurement.granularity).toBe('AXLE');
    // stale id replaced with the reconstructed unaccounted load's id
    expect(s.calibration!.unaccountedLoadId).toBe('cl-resid');
  });

  it('returns clean defaults for an empty setup', () => {
    const s = setupToCalculatorState({});
    expect(s.vehicleVariantId).toBeNull();
    expect(s.accessories).toEqual([]);
    expect(s.customLoads).toEqual([]);
    expect(s.calibration).toBeNull();
  });
});
