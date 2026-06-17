import { describe, it, expect } from 'vitest';
import { buildVariantPatch } from '../promotion';
import type { GateableField } from '../gating';

describe('buildVariantPatch', () => {
  it('parses ints + fuel enum, applies admin override, skips nulls', () => {
    const fields: GateableField[] = [
      { field: 'gvmKg', value: '3260' },
      { field: 'gcmKg', value: '6500', adminValue: '6760' }, // override wins
      { field: 'frontAxleLimitKg', value: null }, // null → omitted
      { field: 'fuelType', value: 'diesel' }, // case-insensitive enum
      { field: 'wheelbaseMm', value: '2850.4' }, // rounds
    ];
    const { patch, skipped } = buildVariantPatch(fields);
    expect(patch.gvmKg).toBe(3260);
    expect(patch.gcmKg).toBe(6760);
    expect('frontAxleLimitKg' in patch).toBe(false);
    expect(patch.fuelType).toBe('DIESEL');
    expect(patch.wheelbaseMm).toBe(2850);
    expect(skipped).toHaveLength(0);
  });

  it('skips unparsable values and unknown fields instead of writing garbage', () => {
    const fields: GateableField[] = [
      { field: 'gvmKg', value: 'three thousand' },
      { field: 'fuelType', value: 'plutonium' },
      { field: 'notARealField', value: '5' },
    ];
    const { patch, skipped } = buildVariantPatch(fields);
    expect(Object.keys(patch)).toHaveLength(0);
    expect(skipped).toEqual(
      expect.arrayContaining(['gvmKg', 'fuelType', 'notARealField']),
    );
  });
});
