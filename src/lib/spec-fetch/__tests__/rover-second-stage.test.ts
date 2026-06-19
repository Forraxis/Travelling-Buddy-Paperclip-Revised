import { describe, it, expect } from 'vitest';
import {
  classifySecondStage,
  isCategoryBumped,
  type ClassifyInput,
} from '../rover/second-stage';

/** Build a ClassifyInput with sensible defaults (second-stage, no signals). */
function row(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    isSecondStage: true,
    make: null,
    model: null,
    modifier: null,
    category: null,
    baseCategory: null,
    raw: null,
    ...overrides,
  };
}

describe('classifySecondStage', () => {
  it('returns NONE for a non-second-stage (factory) row', () => {
    expect(
      classifySecondStage(
        row({ isSecondStage: false, make: 'NISSAN', model: 'D23 Navara' }),
      ),
    ).toBe('NONE');
  });

  it('classifies a known GVM brand as GVM_UPGRADE', () => {
    expect(
      classifySecondStage(
        row({ make: 'PREMCAR', model: 'D23 Navara', modifier: 'PREMCAR' }),
      ),
    ).toBe('GVM_UPGRADE');
    expect(
      classifySecondStage(
        row({
          make: 'IRONMAN TOYOTA',
          model: 'HILUX 8GEN 4WD NB1',
          modifier: 'ironman',
        }),
      ),
    ).toBe('GVM_UPGRADE');
    expect(
      classifySecondStage(
        row({ make: 'LOVELLS Mazda', model: 'BT-50D 3600 NB1' }),
      ),
    ).toBe('GVM_UPGRADE');
  });

  it('does not treat a brand substring as a brand match (arb inside garbage)', () => {
    expect(
      classifySecondStage(row({ make: 'GARBAGE TRUCKS', model: 'Compactor' })),
    ).not.toBe('GVM_UPGRADE');
  });

  it('classifies an explicit GVM / upgrade keyword as GVM_UPGRADE', () => {
    expect(
      classifySecondStage(
        row({ make: 'ARB ISUZU', model: 'D-Max RG1 UPGRADE' }),
      ),
    ).toBe('GVM_UPGRADE');
    expect(
      classifySecondStage(
        row({ make: '4WSUSP TOYOTA', model: 'HILUX 8GEN HIGH GVM' }),
      ),
    ).toBe('GVM_UPGRADE');
  });

  it('classifies a goods-category bump (NA → NB1) as GVM_UPGRADE', () => {
    expect(
      classifySecondStage(
        row({
          make: 'SOMECO TOYOTA',
          model: 'Hilux',
          category: 'NB1',
          baseCategory: 'NA',
        }),
      ),
    ).toBe('GVM_UPGRADE');
  });

  it('does NOT treat a same / lower category as a bump', () => {
    expect(isCategoryBumped('NA', 'NA')).toBe(false);
    expect(isCategoryBumped('NA', 'NB1')).toBe(false);
    expect(isCategoryBumped('NB1', 'NA')).toBe(true);
    // M-series categories are not on the goods ladder → never a bump.
    expect(isCategoryBumped('ME', 'NB1')).toBe(false);
    expect(isCategoryBumped('NB1', 'ME')).toBe(false);
    // Unknown base disables the signal.
    expect(isCategoryBumped('NB1', null)).toBe(false);
  });

  it('classifies a habitation build as MOTORHOME', () => {
    expect(
      classifySecondStage(
        row({
          make: 'AVIDA FIAT',
          model: 'DUCATO II SERIES MOTORHOME',
          modifier: 'avida',
        }),
      ),
    ).toBe('MOTORHOME');
    expect(
      classifySecondStage(
        row({ make: 'HORIZON FIAT', model: 'DUCATO II CAMPERVAN' }),
      ),
    ).toBe('MOTORHOME');
  });

  it('GVM signal beats MOTORHOME keyword when both are present', () => {
    // "Pedders … GVM PLUS … MOTORHOME": the GVM uprate is the load-bearing
    // compliance fact and the overlay routing it triggers is the right one.
    expect(
      classifySecondStage(
        row({
          make: 'EM Pedders Toyota',
          model: 'HILUX GVM PLUS NB MOTORHOME',
          modifier: 'Pedders',
        }),
      ),
    ).toBe('GVM_UPGRADE');
  });

  it('classifies a body/role build as CONVERSION', () => {
    expect(
      classifySecondStage(row({ make: 'VOLGREN', model: '2 AXLE OMNIBUS' })),
    ).toBe('CONVERSION');
    expect(
      classifySecondStage(
        row({ make: 'BODYBUILDER', model: 'Hilux Tray Conversion' }),
      ),
    ).toBe('CONVERSION');
  });

  it('falls back to OTHER for a second-stage row with no recognised signal', () => {
    expect(
      classifySecondStage(row({ make: 'ACME PTY', model: 'Widget 5000' })),
    ).toBe('OTHER');
  });

  it('scans raw grid attributes for a GVM keyword', () => {
    expect(
      classifySecondStage(
        row({
          make: 'SOMECO',
          model: 'Custom',
          raw: {
            'vt.rvr_marketingdesignation': 'High GVM Pack',
            statecode: 0,
          },
        }),
      ),
    ).toBe('GVM_UPGRADE');
  });

  it('is pure — identical input yields identical output', () => {
    const r = row({ make: 'PREMCAR', model: 'D23 Navara' });
    expect(classifySecondStage(r)).toBe(classifySecondStage(r));
  });
});
