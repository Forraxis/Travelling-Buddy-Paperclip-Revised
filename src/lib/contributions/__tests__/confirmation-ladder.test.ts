import { describe, it, expect } from 'vitest';
import {
  resolveLadder,
  collapseVotes,
  isCatalogueLimitField,
  fieldToleranceKg,
  CATALOGUE_LIMIT_FIELDS,
  type NewContribution,
  type ContributionVote,
} from '../confirmation-ladder';
import { extractLimitFields } from '../write-spec-provenance';

function plate(
  value: number,
  overrides: Partial<NewContribution> = {},
): NewContribution {
  const { fingerprint, ...rest } = overrides;
  return {
    field: 'gvmKg',
    value,
    fingerprint:
      fingerprint === undefined ? `fp:${Math.random()}` : `fp:${fingerprint}`,
    isPlate: true,
    gatekeeperAutoApprove: false,
    contributorTier: 'BASIC',
    ...rest,
  };
}

function vote(value: number, fp: string): ContributionVote {
  return { value, fingerprint: fp };
}

describe('confirmation ladder — agreement counts', () => {
  it('1 agreeing → ESTIMATE, no human review', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), []);
    expect(r.status).toBe('ESTIMATE');
    expect(r.corroboratingCount).toBe(1);
    expect(r.requiresHumanReview).toBe(false);
    expect(r.confidence).toBe('LOW');
  });

  it('2 agreeing → ESTIMATE + requiresHumanReview (moderation queue)', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3005, 'fp:b'),
    ]);
    expect(r.status).toBe('ESTIMATE');
    expect(r.corroboratingCount).toBe(2);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.confidence).toBe('MEDIUM');
  });

  it('3+ agreeing → CONFIRMED automatically (escape valve), no human needed', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3010, 'fp:b'),
      vote(2995, 'fp:c'),
    ]);
    expect(r.status).toBe('CONFIRMED');
    expect(r.corroboratingCount).toBe(3);
    expect(r.requiresHumanReview).toBe(false);
    expect(r.confidence).toBe('HIGH');
  });
});

describe('confirmation ladder — trusted authentic plate', () => {
  it('trusted authentic plate (gatekeeper auto_approve) → CONFIRMED directly, single contributor', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: true,
        contributorTier: 'TRUSTED',
      }),
      [],
    );
    expect(r.status).toBe('CONFIRMED');
    expect(r.confidence).toBe('HIGH');
    expect(r.requiresHumanReview).toBe(false);
    expect(r.source).toBe('PLATE');
  });

  it('EXPERT authentic plate also auto-confirms', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: true,
        contributorTier: 'EXPERT',
      }),
      [],
    );
    expect(r.status).toBe('CONFIRMED');
  });

  it('UNTRUSTED single plate does NOT auto-confirm → ESTIMATE', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: true, // gatekeeper clean...
        contributorTier: 'BASIC', // ...but contributor not trusted
      }),
      [],
    );
    expect(r.status).toBe('ESTIMATE');
    expect(r.corroboratingCount).toBe(1);
  });

  it('NEW-tier single plate does NOT auto-confirm even with auto_approve', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: true,
        contributorTier: 'NEW',
      }),
      [],
    );
    expect(r.status).toBe('ESTIMATE');
  });

  it('trusted plate WITHOUT gatekeeper auto_approve does NOT shortcut', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: false,
        contributorTier: 'EXPERT',
      }),
      [],
    );
    expect(r.status).toBe('ESTIMATE');
  });
});

describe('confirmation ladder — disagreement → DISPUTED', () => {
  it('two clusters beyond tolerance → DISPUTED, always human, never auto-confirm', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3500, 'fp:b'), // 500kg apart — way beyond ±25
    ]);
    expect(r.status).toBe('DISPUTED');
    expect(r.requiresHumanReview).toBe(true);
    expect(r.confidence).toBe('LOW');
  });

  it('disagreement is NOT cured by reaching 3 votes — still DISPUTED', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3005, 'fp:b'),
      vote(3008, 'fp:c'),
      vote(3600, 'fp:d'), // one dissenter
    ]);
    expect(r.status).toBe('DISPUTED');
    expect(r.requiresHumanReview).toBe(true);
  });

  it('trusted authentic plate that conflicts with priors → DISPUTED, never silent overwrite', () => {
    const r = resolveLadder(
      plate(3000, {
        fingerprint: 'a',
        gatekeeperAutoApprove: true,
        contributorTier: 'EXPERT',
      }),
      [vote(3500, 'fp:b')],
    );
    expect(r.status).toBe('DISPUTED');
    expect(r.requiresHumanReview).toBe(true);
  });
});

describe('confirmation ladder — contributor dedup', () => {
  it('same contributor (same fingerprint) cannot self-corroborate to confirm', () => {
    // New plate + two prior rows that are actually the SAME contributor.
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3000, 'fp:a'),
      vote(3000, 'fp:a'),
    ]);
    expect(r.corroboratingCount).toBe(1);
    expect(r.status).toBe('ESTIMATE');
  });

  it('two distinct agreeing fingerprints count as 2 → flag', () => {
    const r = resolveLadder(plate(3000, { fingerprint: 'a' }), [
      vote(3000, 'fp:b'),
    ]);
    expect(r.corroboratingCount).toBe(2);
  });

  it('collapseVotes keeps one vote per fingerprint, passes null-fp through', () => {
    const collapsed = collapseVotes([
      vote(3000, 'x'),
      vote(3001, 'x'),
      { value: 3000, fingerprint: null },
      { value: 3000, fingerprint: null },
    ]);
    // one 'x' + two nulls
    expect(collapsed).toHaveLength(3);
  });

  it('two distinct null-fingerprint contributors each count', () => {
    const r = resolveLadder({ ...plate(3000), fingerprint: null }, [
      { value: 3000, fingerprint: null },
    ]);
    expect(r.corroboratingCount).toBe(2);
  });
});

describe('limits-only guardrail', () => {
  it('only the six compliance LIMIT fields are catalogue-writable', () => {
    expect([...CATALOGUE_LIMIT_FIELDS].sort()).toEqual(
      [
        'frontAxleLimitKg',
        'gcmKg',
        'gvmKg',
        'maxTowBallDownloadKg',
        'maxTowingCapacityKg',
        'rearAxleLimitKg',
      ].sort(),
    );
    expect(isCatalogueLimitField('gvmKg')).toBe(true);
    expect(isCatalogueLimitField('kerbWeightKg')).toBe(false);
    expect(isCatalogueLimitField('tareKg')).toBe(false);
    expect(isCatalogueLimitField('wheelbaseMm')).toBe(false);
  });

  it('extractLimitFields DROPS tare/kerb/geometry — a personal tare never reaches the catalogue', () => {
    const extraction = {
      fields: {
        gvmKg: { value: 3500, confidence: 0.95, source: 'plate' },
        gcmKg: { value: 6000, confidence: 0.9, source: 'plate' },
        kerbWeightKg: { value: 2100, confidence: 0.9, source: 'plate' }, // MUST be dropped
        tareKg: { value: 2080, confidence: 0.9, source: 'plate' }, // MUST be dropped
        wheelbaseMm: { value: 3085, confidence: 0.9, source: 'plate' }, // MUST be dropped
      },
    };
    const limits = extractLimitFields(extraction);
    expect(limits).toEqual({ gvmKg: 3500, gcmKg: 6000 });
    expect(limits).not.toHaveProperty('kerbWeightKg');
    expect(limits).not.toHaveProperty('tareKg');
    expect(limits).not.toHaveProperty('wheelbaseMm');
  });

  it('extractLimitFields coerces numeric strings and skips non-positive/garbage', () => {
    const limits = extractLimitFields({
      fields: {
        gvmKg: { value: '3500', source: 'plate' },
        gcmKg: { value: 0, source: 'plate' }, // non-positive → dropped
        frontAxleLimitKg: { value: null, source: 'inferred' }, // null → dropped
        rearAxleLimitKg: { value: 'n/a', source: 'inferred' }, // garbage → dropped
      },
    });
    expect(limits).toEqual({ gvmKg: 3500 });
  });

  it('per-field tolerance: tow-ball is tighter than GVM', () => {
    expect(fieldToleranceKg('maxTowBallDownloadKg')).toBeLessThan(
      fieldToleranceKg('gvmKg'),
    );
    // a value just outside the tow-ball band reads as disagreement
    const r = resolveLadder(
      plate(350, { field: 'maxTowBallDownloadKg', fingerprint: 'a' }),
      [vote(365, 'fp:b')], // 15kg apart, > ±10 tow-ball band
    );
    expect(r.status).toBe('DISPUTED');
  });
});
