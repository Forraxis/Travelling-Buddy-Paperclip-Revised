import { describe, expect, it } from 'vitest';
import { stateToParams, paramsToState } from '../url-params';
import { INITIAL_STATE, DEFAULT_JOURNEY } from '../types';
import type { CalculatorState } from '../types';

describe('stateToParams', () => {
  it('produces empty params for initial state', () => {
    const params = stateToParams(INITIAL_STATE);
    expect(params.toString()).toBe('');
  });

  it('encodes accessories as comma-separated IDs', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      accessories: [
        { accessoryId: 'acc-1', massKg: 5, mountingLocation: 'roof' },
        { accessoryId: 'acc-2', massKg: 10, mountingLocation: 'tow-bar' },
      ],
    };
    expect(stateToParams(state).get('accessories')).toBe('acc-1,acc-2');
  });

  it('omits accessories param when empty', () => {
    expect(stateToParams(INITIAL_STATE).has('accessories')).toBe(false);
  });

  it('encodes vehicleVariantId', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      vehicleVariantId: 'vv-abc',
    };
    expect(stateToParams(state).get('vehicleVariantId')).toBe('vv-abc');
  });

  it('encodes caravanVariantId', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      caravanVariantId: 'cv-xyz',
    };
    expect(stateToParams(state).get('caravanVariantId')).toBe('cv-xyz');
  });

  it('omits journey fields at defaults', () => {
    const params = stateToParams(INITIAL_STATE);
    expect(params.has('passengers')).toBe(false);
    expect(params.has('fuelPercent')).toBe(false);
  });

  it('encodes non-default journey fields', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      journey: { ...DEFAULT_JOURNEY, passengers: 4, fuelPercent: 50 },
    };
    const params = stateToParams(state);
    expect(params.get('passengers')).toBe('4');
    expect(params.get('fuelPercent')).toBe('50');
    expect(params.has('cargoKg')).toBe(false);
  });
});

describe('paramsToState', () => {
  it('returns initial state for empty params', () => {
    const state = paramsToState(new URLSearchParams());
    expect(state).toEqual(INITIAL_STATE);
  });

  it('restores vehicleVariantId from params', () => {
    const params = new URLSearchParams('vehicleVariantId=vv-abc');
    const state = paramsToState(params);
    expect(state.vehicleVariantId).toBe('vv-abc');
    expect(state.caravanVariantId).toBeNull();
  });

  it('restores both variant IDs', () => {
    const params = new URLSearchParams(
      'vehicleVariantId=vv-1&caravanVariantId=cv-2',
    );
    const state = paramsToState(params);
    expect(state.vehicleVariantId).toBe('vv-1');
    expect(state.caravanVariantId).toBe('cv-2');
  });

  it('restores journey assumptions', () => {
    const params = new URLSearchParams(
      'passengers=4&fuelPercent=50&cargoKg=80',
    );
    const state = paramsToState(params);
    expect(state.journey.passengers).toBe(4);
    expect(state.journey.fuelPercent).toBe(50);
    expect(state.journey.cargoKg).toBe(80);
    expect(state.journey.freshWaterPercent).toBe(
      DEFAULT_JOURNEY.freshWaterPercent,
    );
  });

  it('clamps passengers to valid range', () => {
    expect(
      paramsToState(new URLSearchParams('passengers=0')).journey.passengers,
    ).toBe(1);
    expect(
      paramsToState(new URLSearchParams('passengers=99')).journey.passengers,
    ).toBe(9);
  });

  it('clamps percent values to 0-100', () => {
    expect(
      paramsToState(new URLSearchParams('fuelPercent=-10')).journey.fuelPercent,
    ).toBe(0);
    expect(
      paramsToState(new URLSearchParams('fuelPercent=200')).journey.fuelPercent,
    ).toBe(100);
  });

  it('ignores invalid numeric values and falls back to defaults', () => {
    const params = new URLSearchParams('passengers=not-a-number');
    const state = paramsToState(params);
    expect(state.journey.passengers).toBe(DEFAULT_JOURNEY.passengers);
  });

  it('restores accessory IDs from comma-separated param', () => {
    const params = new URLSearchParams('accessories=acc-1,acc-2,acc-3');
    const state = paramsToState(params);
    expect(state.accessories).toHaveLength(3);
    expect(state.accessories[0].accessoryId).toBe('acc-1');
    expect(state.accessories[2].accessoryId).toBe('acc-3');
  });

  it('returns empty accessories for empty params', () => {
    expect(paramsToState(new URLSearchParams()).accessories).toEqual([]);
  });

  it('preserves order of accessory IDs', () => {
    const params = new URLSearchParams('accessories=z,a,m');
    const state = paramsToState(params);
    expect(state.accessories.map((a) => a.accessoryId)).toEqual([
      'z',
      'a',
      'm',
    ]);
  });

  it('round-trips through stateToParams → paramsToState (preserves IDs)', () => {
    const original: CalculatorState = {
      vehicleVariantId: 'vv-abc',
      caravanVariantId: 'cv-xyz',
      journey: {
        passengers: 3,
        passengerWeightKg: 80,
        cargoKg: 50,
        fuelPercent: 75,
        freshWaterPercent: 80,
        greyWaterPercent: 20,
        gearKg: 10,
      },
      caravanAssumptions: { freshWaterL: 0, greyWaterL: 0, gearKg: 0 },
      accessories: [
        { accessoryId: 'acc-1', massKg: 5, mountingLocation: 'roof' },
        { accessoryId: 'acc-2', massKg: 10, mountingLocation: 'tow-bar' },
      ],
      caravanAccessories: [
        { accessoryId: 'cv-acc-1', massKg: 3, mountingLocation: 'front' },
      ],
    };
    const restored = paramsToState(stateToParams(original));
    expect(restored.vehicleVariantId).toBe('vv-abc');
    expect(restored.caravanVariantId).toBe('cv-xyz');
    expect(restored.journey).toEqual(original.journey);
    expect(restored.accessories.map((a) => a.accessoryId)).toEqual([
      'acc-1',
      'acc-2',
    ]);
    expect(restored.caravanAccessories.map((a) => a.accessoryId)).toEqual([
      'cv-acc-1',
    ]);
  });

  it('encodes caravanAccessories as comma-separated IDs', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      caravanAccessories: [
        { accessoryId: 'cv-1', massKg: 2, mountingLocation: 'front' },
        { accessoryId: 'cv-2', massKg: 4, mountingLocation: 'rear' },
      ],
    };
    expect(stateToParams(state).get('caravanAccessories')).toBe('cv-1,cv-2');
  });

  it('omits caravanAccessories param when empty', () => {
    expect(stateToParams(INITIAL_STATE).has('caravanAccessories')).toBe(false);
  });

  it('encodes a dragged accessory position as id~x~y', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      accessories: [
        { accessoryId: 'acc-1', massKg: 5, mountingLocation: 'roof' },
        {
          accessoryId: 'acc-2',
          massKg: 10,
          mountingLocation: 'tow-bar',
          cogXMm: -1234,
          cogYMm: 250,
        },
      ],
    };
    expect(stateToParams(state).get('accessories')).toBe(
      'acc-1,acc-2~-1234~250',
    );
  });

  it('round-trips a dragged position through params', () => {
    const state: CalculatorState = {
      ...INITIAL_STATE,
      accessories: [
        {
          accessoryId: 'acc-2',
          massKg: 0,
          mountingLocation: '',
          cogXMm: -1234,
          cogYMm: 250,
        },
      ],
    };
    const restored = paramsToState(stateToParams(state));
    expect(restored.accessories[0].cogXMm).toBe(-1234);
    expect(restored.accessories[0].cogYMm).toBe(250);
  });

  it('leaves cogX/Y undefined for un-positioned accessories', () => {
    const restored = paramsToState(
      new URLSearchParams('accessories=acc-1,acc-2'),
    );
    expect(restored.accessories[0].cogXMm).toBeUndefined();
    expect(restored.accessories[1].cogYMm).toBeUndefined();
  });

  it('restores caravanAccessory IDs from comma-separated param', () => {
    const params = new URLSearchParams('caravanAccessories=cv-1,cv-2,cv-3');
    const state = paramsToState(params);
    expect(state.caravanAccessories).toHaveLength(3);
    expect(state.caravanAccessories[0].accessoryId).toBe('cv-1');
    expect(state.caravanAccessories[2].accessoryId).toBe('cv-3');
  });

  it('returns empty caravanAccessories for empty params', () => {
    expect(paramsToState(new URLSearchParams()).caravanAccessories).toEqual([]);
  });
});
