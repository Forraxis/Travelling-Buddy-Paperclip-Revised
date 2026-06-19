import { describe, it, expect } from 'vitest';
import { customGvmUpgradeSchema, gvmUpgradeAdminSchema } from '../types';

describe('customGvmUpgradeSchema', () => {
  it('requires an upgraded GVM', () => {
    const r = customGvmUpgradeSchema.safeParse({ gcmKg: 7000 });
    expect(r.success).toBe(false);
  });

  it('accepts a GVM-only override and nulls the unstated limits', () => {
    const r = customGvmUpgradeSchema.safeParse({ gvmKg: 3500 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gvmKg).toBe(3500);
      // unstated limits become explicit null (= keep factory)
      expect(r.data.gcmKg).toBeNull();
      expect(r.data.maxTowingKg).toBeNull();
    }
  });

  it('rejects a non-positive / non-integer limit', () => {
    expect(customGvmUpgradeSchema.safeParse({ gvmKg: -10 }).success).toBe(
      false,
    );
    expect(customGvmUpgradeSchema.safeParse({ gvmKg: 3500.5 }).success).toBe(
      false,
    );
  });

  it('accepts a certified state + engineer ref', () => {
    const r = customGvmUpgradeSchema.safeParse({
      gvmKg: 3500,
      certifiedState: 'QLD',
      engineerRef: 'ENG-123',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.certifiedState).toBe('QLD');
      expect(r.data.engineerRef).toBe('ENG-123');
    }
  });
});

describe('gvmUpgradeAdminSchema', () => {
  it('requires a modifier name + valid pathway', () => {
    expect(
      gvmUpgradeAdminSchema.safeParse({
        modifierName: '',
        pathway: 'POST_REGO_SSM',
      }).success,
    ).toBe(false);
    expect(
      gvmUpgradeAdminSchema.safeParse({
        modifierName: 'Lovells GVM',
        pathway: 'NOPE',
      }).success,
    ).toBe(false);
  });

  it('parses a kit with partial limits (blanks become null)', () => {
    const r = gvmUpgradeAdminSchema.safeParse({
      modifierName: 'Lovells GVM Upgrade',
      pathway: 'PRE_REGO_SECOND_STAGE',
      gvmKg: 3500,
      isPreRego: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gvmKg).toBe(3500);
      expect(r.data.gcmKg).toBeNull();
      expect(r.data.isPreRego).toBe(true);
      expect(r.data.vtaNumber).toBeNull();
    }
  });

  it('coerces an empty source URL to null and rejects a malformed one', () => {
    const ok = gvmUpgradeAdminSchema.safeParse({
      modifierName: 'Kit',
      pathway: 'STATE_ENGINEER',
      sourceUrl: '',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.sourceUrl).toBeNull();

    const bad = gvmUpgradeAdminSchema.safeParse({
      modifierName: 'Kit',
      pathway: 'STATE_ENGINEER',
      sourceUrl: 'not-a-url',
    });
    expect(bad.success).toBe(false);
  });
});
