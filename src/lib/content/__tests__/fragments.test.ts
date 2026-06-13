import { describe, it, expect } from 'vitest';
import { comboFragmentCriteria } from '../fragments';

describe('comboFragmentCriteria', () => {
  it('maps vehicle body types onto the fragment vocabulary', () => {
    expect(
      comboFragmentCriteria({ vehicleBodyType: 'DUAL_CAB_UTE' }),
    ).toHaveProperty('vehicle_body_type', 'ute');
    expect(
      comboFragmentCriteria({ vehicleBodyType: 'TROOPCARRIER' }),
    ).toHaveProperty('vehicle_body_type', 'troopcarrier');
    expect(comboFragmentCriteria({ vehicleBodyType: 'WAGON' })).toHaveProperty(
      'vehicle_body_type',
      'wagon',
    );
    expect(comboFragmentCriteria({ vehicleBodyType: 'SUV' })).toHaveProperty(
      'vehicle_body_type',
      'suv',
    );
  });

  it('buckets caravan ATM into size classes', () => {
    expect(
      comboFragmentCriteria({ caravanAtmKg: 1500 }).caravan_size_class,
    ).toBe('small');
    expect(
      comboFragmentCriteria({ caravanAtmKg: 2500 }).caravan_size_class,
    ).toBe('medium');
    expect(
      comboFragmentCriteria({ caravanAtmKg: 3300 }).caravan_size_class,
    ).toBe('large');
  });

  it('buckets GVM headroom into a single non-overlapping band', () => {
    expect(
      comboFragmentCriteria({ gvmHeadroomKg: 50 }).gvm_headroom_range,
    ).toBe('0-100kg');
    expect(
      comboFragmentCriteria({ gvmHeadroomKg: 150 }).gvm_headroom_range,
    ).toBe('0-200kg');
    expect(
      comboFragmentCriteria({ gvmHeadroomKg: 250 }).gvm_headroom_range,
    ).toBe('100-300kg');
    expect(
      comboFragmentCriteria({ gvmHeadroomKg: 400 }).gvm_headroom_range,
    ).toBe('200-500kg');
    expect(
      comboFragmentCriteria({ gvmHeadroomKg: 800 }).gvm_headroom_range,
    ).toBe('500kg+');
  });

  it('maps axle configuration', () => {
    expect(
      comboFragmentCriteria({ axleConfiguration: 'SINGLE_AXLE' }).axle_config,
    ).toBe('single');
    expect(
      comboFragmentCriteria({ axleConfiguration: 'DUAL_AXLE_SPREAD' })
        .axle_config,
    ).toBe('tandem');
    expect(
      comboFragmentCriteria({ axleConfiguration: 'TRIPLE_AXLE' }).axle_config,
    ).toBe('triple');
  });

  it('omits dimensions whose inputs are null', () => {
    expect(comboFragmentCriteria({})).toEqual({});
  });
});
