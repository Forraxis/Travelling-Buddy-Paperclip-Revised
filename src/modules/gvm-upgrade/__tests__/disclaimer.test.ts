import { describe, it, expect } from 'vitest';
import {
  GVM_UPGRADE_DISCLAIMER,
  gvmUpgradeDisclaimerAsOf,
} from '../disclaimer';

describe('gvmUpgradeDisclaimerAsOf', () => {
  it('formats the date deterministically as YYYY-MM-DD (no locale)', () => {
    const stamp = gvmUpgradeDisclaimerAsOf(new Date('2026-06-19T09:30:00Z'));
    expect(stamp).toBe('Current as of 2026-06-19.');
  });

  it('uses the UTC date regardless of the time of day', () => {
    const stamp = gvmUpgradeDisclaimerAsOf(new Date('2026-01-05T23:59:59Z'));
    expect(stamp).toBe('Current as of 2026-01-05.');
  });

  it('disclaimer body flags advisory / not legal advice', () => {
    expect(GVM_UPGRADE_DISCLAIMER).toMatch(/advisory/i);
    expect(GVM_UPGRADE_DISCLAIMER).toMatch(/not legal advice/i);
    expect(GVM_UPGRADE_DISCLAIMER).toMatch(/plate/i);
  });
});
