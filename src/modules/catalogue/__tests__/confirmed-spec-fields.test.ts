import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_FIELD_META,
  formatConfirmedValue,
  sourceLabel,
} from '../lib/confirmed-spec-fields';
import { CONFIRMED_SPEC_FIELDS } from '../queries/confirmed-spec.queries';

describe('confirmed-spec field metadata', () => {
  it('has display metadata for every published field', () => {
    for (const field of CONFIRMED_SPEC_FIELDS) {
      expect(CONFIRMED_FIELD_META[field]).toBeDefined();
      expect(CONFIRMED_FIELD_META[field].label.length).toBeGreaterThan(0);
      expect(CONFIRMED_FIELD_META[field].short.length).toBeGreaterThan(0);
    }
  });
});

describe('formatConfirmedValue', () => {
  it('formats kg fields with thousands separators + unit', () => {
    expect(formatConfirmedValue('gvmKg', '4250')).toBe('4,250 kg');
    expect(formatConfirmedValue('maxTowingCapacityKg', '3500')).toBe(
      '3,500 kg',
    );
  });

  it('formats mm fields with the mm unit', () => {
    expect(formatConfirmedValue('wheelbaseMm', '3085')).toBe('3,085 mm');
  });

  it('renders a non-numeric value verbatim without throwing', () => {
    expect(formatConfirmedValue('gvmKg', 'n/a')).toBe('n/a');
  });
});

describe('sourceLabel', () => {
  it('labels ROVER as the federal approval source', () => {
    expect(sourceLabel('ROVER')).toContain('ROVER');
  });

  it('labels a compliance plate', () => {
    expect(sourceLabel('PLATE')).toBe('compliance plate');
  });

  it('never leaks the raw CLAUDE estimate provider to the public label', () => {
    // CLAUDE values are ESTIMATE and must not reach this page; if one ever did,
    // the label must stay generic, never "AI estimate".
    expect(sourceLabel('CLAUDE').toLowerCase()).not.toContain('claude');
    expect(sourceLabel('CLAUDE').toLowerCase()).not.toContain('estimate');
  });
});
