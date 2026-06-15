import { describe, expect, it } from 'vitest';
import { accessoryFootprint } from '../accessory-footprint';

describe('accessoryFootprint', () => {
  it('makes a bull bar wide and shallow', () => {
    const fp = accessoryFootprint('BULL_BAR', 60);
    expect(fp.widthMm).toBeGreaterThan(fp.lengthMm);
  });

  it('makes a roof rack long (fore-aft)', () => {
    const fp = accessoryFootprint('ROOF_RACK', 25);
    expect(fp.lengthMm).toBeGreaterThan(700);
  });

  it('scales up with mass', () => {
    const light = accessoryFootprint('TUB_INTERIOR', 5);
    const heavy = accessoryFootprint('TUB_INTERIOR', 120);
    expect(heavy.lengthMm).toBeGreaterThan(light.lengthMm);
    expect(heavy.widthMm).toBeGreaterThan(light.widthMm);
  });

  it('caps the mass factor so nothing renders absurd', () => {
    const huge = accessoryFootprint('TUB_INTERIOR', 100000);
    const base = accessoryFootprint('TUB_INTERIOR', 20);
    // Capped at 1.4× the base footprint.
    expect(huge.lengthMm).toBeLessThanOrEqual(
      Math.round(base.lengthMm * 1.4) + 1,
    );
  });

  it('falls back to a default footprint for unknown mounts', () => {
    const fp = accessoryFootprint('SOMETHING_NEW', 20);
    expect(fp.lengthMm).toBeGreaterThan(0);
    expect(fp.widthMm).toBeGreaterThan(0);
  });
});
