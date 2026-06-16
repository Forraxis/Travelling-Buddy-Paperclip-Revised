import { describe, it, expect } from 'vitest';
import { calibrationFingerprint } from '../duplicate-detection';

const base = {
  vehicleVariantId: 'variant-1',
  granularity: 'AXLE',
  measurement: { frontAxleKg: 1200, rearAxleKg: 1000 },
  kerbWeightKg: 2200,
};

describe('calibrationFingerprint', () => {
  it('is keyed on the submitter (one vote per variant) when signed in', () => {
    const a = calibrationFingerprint({ ...base, submitterId: 'user-1' });
    const b = calibrationFingerprint({
      ...base,
      submitterId: 'user-1',
      measurement: { frontAxleKg: 999, rearAxleKg: 1 }, // different ticket
    });
    expect(a).toBe(b); // same user + variant → same fingerprint, regardless of ticket
  });

  it('separates the same user across variants', () => {
    const a = calibrationFingerprint({ ...base, submitterId: 'user-1' });
    const b = calibrationFingerprint({
      ...base,
      submitterId: 'user-1',
      vehicleVariantId: 'variant-2',
    });
    expect(a).not.toBe(b);
  });

  it('collapses identical anonymous tickets (rounded to the kg)', () => {
    const a = calibrationFingerprint({ ...base, submitterId: null });
    const b = calibrationFingerprint({
      ...base,
      submitterId: null,
      measurement: { frontAxleKg: 1200.3, rearAxleKg: 999.6 }, // round to same kg
    });
    expect(a).toBe(b);
  });

  it('distinguishes anonymous tickets with different values', () => {
    const a = calibrationFingerprint({ ...base, submitterId: null });
    const b = calibrationFingerprint({
      ...base,
      submitterId: null,
      measurement: { frontAxleKg: 1300, rearAxleKg: 1000 },
    });
    expect(a).not.toBe(b);
  });

  it('a signed-in user and an anon ticket never collide', () => {
    const signedIn = calibrationFingerprint({ ...base, submitterId: 'user-1' });
    const anon = calibrationFingerprint({ ...base, submitterId: null });
    expect(signedIn).not.toBe(anon);
  });
});
