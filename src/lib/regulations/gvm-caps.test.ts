import { describe, it, expect } from 'vitest';
import {
  validateGvmUpgradeAgainstCap,
  interstateRecognitionWarning,
  type GvmCapData,
  type GvmCapRule,
} from './gvm-caps';

/** QLD: lower of +300 kg or +10% of base GVM. */
const QLD_RULE: GvmCapRule = {
  addKg: 300,
  percentOfBase: 10,
  label: 'lower of +300 kg or +10%',
  signedOff: false,
};

/** Federal SSM: no fixed ceiling — certifier governs. */
const FEDERAL_RULE: GvmCapRule = {
  unlimited: true,
  label: 'no fixed cap (second-stage certifier governs)',
  signedOff: false,
};

const CAP_DATA: GvmCapData = { QLD: QLD_RULE, FEDERAL: FEDERAL_RULE };

describe('validateGvmUpgradeAgainstCap', () => {
  it("Tim's QLD example: base 2900 → +280 governed by +10%, within spec", () => {
    // 10% of 2900 = 290 < 300, so the percent limb governs.
    const result = validateGvmUpgradeAgainstCap(2900, 280, 'QLD', CAP_DATA);
    expect(result.governedBy).toBe('PERCENT');
    expect(result.capKg).toBe(290);
    expect(result.withinSpec).toBe(true);
    expect(result.deltaKg).toBe(280);
    expect(result.signedOff).toBe(false);
  });

  it('rejects a delta over the governing percent cap', () => {
    // 10% of 2900 = 290; +295 exceeds it.
    const result = validateGvmUpgradeAgainstCap(2900, 295, 'QLD', CAP_DATA);
    expect(result.governedBy).toBe('PERCENT');
    expect(result.capKg).toBe(290);
    expect(result.withinSpec).toBe(false);
  });

  it('the +300 kg limb governs when it is the lower of the two', () => {
    // Base 3500 → 10% = 350 > 300, so the absolute +300 limb governs.
    const result = validateGvmUpgradeAgainstCap(3500, 280, 'QLD', CAP_DATA);
    expect(result.governedBy).toBe('ADD_KG');
    expect(result.capKg).toBe(300);
    expect(result.withinSpec).toBe(true);
  });

  it('a delta exactly on the cap is within spec (inclusive)', () => {
    const result = validateGvmUpgradeAgainstCap(2900, 290, 'QLD', CAP_DATA);
    expect(result.withinSpec).toBe(true);
    expect(result.capKg).toBe(290);
  });

  it('Federal SSM is unlimited — always within spec, governedBy NONE', () => {
    const result = validateGvmUpgradeAgainstCap(
      3500,
      1200,
      'FEDERAL',
      CAP_DATA,
    );
    expect(result.withinSpec).toBe(true);
    expect(result.capKg).toBeNull();
    expect(result.governedBy).toBe('NONE');
  });

  it('treats a missing state rule as unlimited (does not fail-closed)', () => {
    const result = validateGvmUpgradeAgainstCap(3500, 500, 'NT', CAP_DATA);
    expect(result.withinSpec).toBe(true);
    expect(result.capKg).toBeNull();
    expect(result.governedBy).toBe('NONE');
    expect(result.signedOff).toBe(false);
  });

  it('accepts a single rule directly (not just a map)', () => {
    const result = validateGvmUpgradeAgainstCap(2900, 280, 'QLD', QLD_RULE);
    expect(result.governedBy).toBe('PERCENT');
    expect(result.withinSpec).toBe(true);
  });

  it('honours a percent-only rule', () => {
    const rule: GvmCapRule = {
      percentOfBase: 10,
      label: '+10%',
      signedOff: false,
    };
    const result = validateGvmUpgradeAgainstCap(3000, 320, 'QLD', rule);
    expect(result.governedBy).toBe('PERCENT');
    expect(result.capKg).toBe(300);
    expect(result.withinSpec).toBe(false);
  });

  it('honours an add-kg-only rule', () => {
    const rule: GvmCapRule = {
      addKg: 400,
      label: '+400 kg',
      signedOff: false,
    };
    const result = validateGvmUpgradeAgainstCap(3000, 350, 'QLD', rule);
    expect(result.governedBy).toBe('ADD_KG');
    expect(result.capKg).toBe(400);
    expect(result.withinSpec).toBe(true);
  });
});

describe('interstateRecognitionWarning', () => {
  it('warns when home state differs from the certified state', () => {
    const warning = interstateRecognitionWarning('NSW', 'QLD');
    expect(warning).toContain('QLD');
    expect(warning).toContain('NSW');
    expect(warning).toMatch(/not guaranteed/i);
  });

  it('is silent when home state matches the certified state', () => {
    expect(interstateRecognitionWarning('QLD', 'QLD')).toBeNull();
  });

  it('is silent when either state is missing', () => {
    expect(interstateRecognitionWarning(null, 'QLD')).toBeNull();
    expect(interstateRecognitionWarning('QLD', null)).toBeNull();
    expect(interstateRecognitionWarning(undefined, undefined)).toBeNull();
  });
});
