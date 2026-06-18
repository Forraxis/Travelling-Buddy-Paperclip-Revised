import { describe, it, expect } from 'vitest';
import {
  RoverVerifier,
  SyntheticRoverParser,
  PdfRoverParser,
  draftGateableFields,
  fieldForLabel,
  extractNumeric,
  SYNTHETIC_APPROVAL_REF,
  SYNTHETIC_REPORT_ROWS,
} from '../rover';
import { evaluatePromotionGate } from '../gating';

const SOURCE = {
  ref: SYNTHETIC_APPROVAL_REF,
  rows: SYNTHETIC_REPORT_ROWS,
};

describe('fieldForLabel', () => {
  it('maps the report labels to canonical field keys (specific before generic)', () => {
    expect(fieldForLabel('Gross Combination Mass (GCM)')).toBe('gcmKg');
    expect(fieldForLabel('Gross Vehicle Mass (GVM)')).toBe('gvmKg');
    expect(fieldForLabel('Front axle maximum mass')).toBe('frontAxleLimitKg');
    expect(fieldForLabel('Rear axle maximum mass')).toBe('rearAxleLimitKg');
    expect(fieldForLabel('Maximum braked towing capacity')).toBe(
      'maxTowingCapacityKg',
    );
    expect(fieldForLabel('Maximum tow-ball download')).toBe(
      'maxTowBallDownloadKg',
    );
    expect(fieldForLabel('Tare mass')).toBe('kerbWeightKg');
  });

  it('returns null for an unmapped label (never invents a field)', () => {
    expect(fieldForLabel('ANCAP safety rating')).toBeNull();
  });
});

describe('extractNumeric', () => {
  it('pulls the figure out of a formatted cell', () => {
    expect(extractNumeric('3,500 kg')).toBe('3500');
    expect(extractNumeric('350 kg max')).toBe('350');
  });
  it('returns null when there is no number (null-not-guess)', () => {
    expect(extractNumeric('N/A')).toBeNull();
    expect(extractNumeric('-')).toBeNull();
  });
});

describe('SyntheticRoverParser', () => {
  it('extracts mapped fields, nulls an empty cell, ignores unmapped rows', async () => {
    const result = await new SyntheticRoverParser().parse(SOURCE);
    const byKey = Object.fromEntries(result.fields.map((f) => [f.field, f]));

    expect(byKey.gvmKg.value).toBe('3230');
    expect(byKey.gcmKg.value).toBe('6400');
    expect(byKey.frontAxleLimitKg.value).toBe('1480');
    expect(byKey.rearAxleLimitKg.value).toBe('1950');
    expect(byKey.maxTowingCapacityKg.value).toBe('3500');
    expect(byKey.maxTowBallDownloadKg.value).toBe('350');
    expect(byKey.kerbWeightKg.value).toBe('2250');
    // Enum field passes through, upper-cased.
    expect(byKey.fuelType.value).toBe('DIESEL');
    // "N/A" fuel-tank cell → null, NOT 0.
    expect(byKey.fuelTankCapacityL.value).toBeNull();
    // Unmapped ANCAP row never produced a field.
    expect(result.fields.some((f) => f.field.startsWith('ancap'))).toBe(false);
  });

  it('throws when handed a PDF-only source (no rows)', async () => {
    await expect(
      new SyntheticRoverParser().parse({ ref: SYNTHETIC_APPROVAL_REF }),
    ).rejects.toThrow(/requires pre-extracted/i);
  });
});

describe('PdfRoverParser', () => {
  it('is an explicit not-implemented stub until a real sample lands', async () => {
    await expect(new PdfRoverParser().parse(SOURCE)).rejects.toThrow(
      /not implemented/i,
    );
  });
});

describe('RoverVerifier', () => {
  it('auto-corroborates present fields and clears the promotion gate without override', async () => {
    const draft = await new RoverVerifier(new SyntheticRoverParser()).verify(
      SOURCE,
    );

    const critical = draft.fields.filter((f) => f.isComplianceCritical);
    expect(critical.length).toBeGreaterThan(0);
    // Every present critical field is corroborated (structured-parse trust).
    for (const f of critical) {
      if (f.value !== null) expect(f.corroborated).toBe(true);
      expect(f.sourceUrl).toBe(SYNTHETIC_APPROVAL_REF.reportUrl);
    }

    // The whole point: ROVER critical fields pass the gate with NO admin override.
    const gate = evaluatePromotionGate(draftGateableFields(draft), false);
    expect(gate.allowed).toBe(true);
    expect(gate.requiresOverride).toBe(false);
    expect(gate.blockingFields).toEqual([]);
  });

  it('does not corroborate a field the report did not state', async () => {
    const draft = await new RoverVerifier(new SyntheticRoverParser()).verify(
      SOURCE,
    );
    const fuelTank = draft.fields.find((f) => f.field === 'fuelTankCapacityL');
    expect(fuelTank?.value).toBeNull();
    expect(fuelTank?.corroborated).toBe(false);
  });
});
