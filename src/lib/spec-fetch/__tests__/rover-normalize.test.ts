import { describe, it, expect, beforeEach } from 'vitest';
import { RoverMakeNormalizer, cleanBaseModel } from '../rover/normalize';

// The factory rows the normalizer learns from (clean OEM makes).
const FACTORY = [
  { make: 'NISSAN', model: 'D23 Navara' },
  { make: 'NISSAN', model: 'D27 Navara' },
  { make: 'Toyota', model: 'Hilux 8GEN' },
  { make: 'Isuzu', model: 'D-MAX' },
];

describe('RoverMakeNormalizer', () => {
  let n: RoverMakeNormalizer;
  beforeEach(() => {
    n = new RoverMakeNormalizer();
    n.learnFrom(FACTORY);
  });

  it('passes a clean factory make straight through (baseModel cleaned to the model word)', () => {
    expect(n.normalize('NISSAN', 'D23 Navara')).toEqual({
      baseMake: 'Nissan',
      // "D23" is a platform code dropped in favour of the real model word.
      baseModel: 'Navara',
      modifier: null,
      isSecondStage: false,
      status: 'AUTO',
    });
  });

  it('recovers base make from the MODEL when the make is a pure modifier (Premcar → Nissan)', () => {
    const r = n.normalize('PREMCAR', 'D23 Navara');
    expect(r.baseMake).toBe('Nissan');
    // Inference still uses the raw "D23"/"Navara" tokens; the emitted baseModel is cleaned.
    expect(r.baseModel).toBe('Navara');
    expect(r.modifier).toBe('PREMCAR');
    expect(r.isSecondStage).toBe(true);
    expect(r.status).toBe('AUTO');
  });

  it('strips a modifier PREFIX when the make contains an OEM token', () => {
    expect(n.normalize('CAR NISSAN', 'D27 Navara HD')).toMatchObject({
      baseMake: 'Nissan',
      modifier: 'car',
      isSecondStage: true,
      status: 'AUTO',
    });
    expect(
      n.normalize('IRONMAN TOYOTA HILUX 8GEN 4WD', 'Hilux 8GEN'),
    ).toMatchObject({
      baseMake: 'Toyota',
      modifier: 'ironman',
      isSecondStage: true,
    });
    expect(n.normalize('IAL ISUZU NR 4x2', 'NR').baseMake).toBe('Isuzu');
  });

  it('handles multi-word / aliased OEMs', () => {
    expect(n.normalize('Mercedes-Benz', 'Sprinter').baseMake).toBe(
      'Mercedes-Benz',
    );
    expect(n.normalize('MERCEDES-BENZ', 'Sprinter').baseMake).toBe(
      'Mercedes-Benz',
    );
  });

  it('flags NEEDS_REVIEW when neither make nor model resolves to an OEM', () => {
    const r = n.normalize('ACME CAMPERS', 'Trailblazer 9000');
    expect(r.baseMake).toBeNull();
    expect(r.modifier).toBe('ACME CAMPERS');
    expect(r.isSecondStage).toBe(true);
    expect(r.status).toBe('NEEDS_REVIEW');
  });

  it('does not learn model→make from second-stage rows (only factory)', () => {
    const fresh = new RoverMakeNormalizer();
    // Only a second-stage row present — must NOT teach "navara → Premcar".
    fresh.learnFrom([{ make: 'PREMCAR', model: 'D23 Navara' }]);
    expect(fresh.normalize('PREMCAR', 'D23 Navara').baseMake).toBeNull();
  });

  // ── Tail-resolution improvements ──────────────────────────────────────────

  it('resolves short single-token OEM makes (MG / UD) that the seed list dropped', () => {
    // Regression: the >=3 token guard used to drop whole 2-char makes entirely,
    // sending every MG/UD row to NEEDS_REVIEW.
    expect(n.normalize('MG', 'ZS EV')).toMatchObject({
      baseMake: 'MG',
      modifier: null,
      isSecondStage: false,
      status: 'AUTO',
    });
    expect(n.normalize('UD', 'Quon').baseMake).toBe('UD');
    // ...but a short generic FRAGMENT of a multi-word make must NOT resolve alone.
    expect(n.normalize('LAND', 'Whatever').baseMake).toBeNull();
  });

  it('recognises newly-added unambiguous OEM makes', () => {
    expect(n.normalize('Ferrari', '296 GTB').baseMake).toBe('Ferrari');
    expect(n.normalize('Aston Martin', 'DBX').baseMake).toBe('Aston Martin');
    expect(n.normalize('SANY', 'SY4').baseMake).toBe('Sany');
    expect(n.normalize('XPENG', 'G6').baseMake).toBe('XPeng');
  });

  it('maps brand aliases / rebrands to the canonical OEM', () => {
    expect(n.normalize('KGM', 'Musso').baseMake).toBe('SsangYong');
    expect(n.normalize('ROLLS-ROYCE', 'Spectre').baseMake).toBe('Rolls-Royce');
    expect(n.normalize('SINOTRUCK', 'HOWO').baseMake).toBe('Sinotruk');
  });

  it('recovers via a conservative substring model match when the exact token misses', () => {
    // No space, so "navarahd" is a single token — the exact-token vote misses,
    // but the >=4 distinctive learned token "navara" is a substring of it.
    const r = n.normalize('SMALLBUILDER', 'NavaraHD');
    expect(r.baseMake).toBe('Nissan');
    expect(r.modifier).toBe('SMALLBUILDER');
    expect(r.isSecondStage).toBe(true);
    expect(r.status).toBe('AUTO');
  });

  it('does not substring-match on short / ambiguous learned tokens', () => {
    // "d23" is only 3 chars → never used for substring matching, so a random code
    // that happens to contain it must not resolve.
    expect(n.normalize('UNKNOWNCO', 'XD23Y').baseMake).toBeNull();
  });

  it('recovers the base make from raw grid attributes as a last resort', () => {
    // make + model carry no OEM signal, but a manufacturer field in the grid does.
    const raw = {
      'cv.rvr_manufacturer': 'BODYBUILDER PTY LTD',
      'vt.rvr_marketingdesignation': 'Toyota Hilux Tray Conversion',
      statecode: 0,
    };
    const r = n.normalize('BODYBUILDER', 'Custom Tray', raw);
    expect(r.baseMake).toBe('Toyota');
    expect(r.modifier).toBe('BODYBUILDER');
    expect(r.isSecondStage).toBe(true);
    expect(r.status).toBe('AUTO');
  });

  it('keeps raw-scan conservative — ambiguous raw stays NEEDS_REVIEW, and the 2-arg path is unchanged', () => {
    // Two different OEMs implied by the grid → ambiguous → do not resolve.
    const ambiguous = {
      a: 'Toyota landcruiser donor',
      b: 'Nissan patrol option',
    };
    expect(
      n.normalize('ACME', 'Trailblazer 9000', ambiguous).baseMake,
    ).toBeNull();
    // No raw passed → identical to the original 2-arg behaviour.
    expect(n.normalize('ACME CAMPERS', 'Trailblazer 9000')).toMatchObject({
      baseMake: null,
      status: 'NEEDS_REVIEW',
    });
  });
});

describe('cleanBaseModel', () => {
  it('strips trim / drive / SSM / GVM noise down to the base model name', () => {
    // The canonical example from the build spec.
    expect(cleanBaseModel('Hilux AN2 SSM 4x4')).toBe('Hilux');
    expect(cleanBaseModel('Hilux 8GEN SSM HIGH GVM')).toBe('Hilux');
    expect(cleanBaseModel('Hilux AN2 SSM GVM+')).toBe('Hilux');
    expect(cleanBaseModel('HILUX GVM PLUS NB MOTORHOME')).toBe('HILUX');
    expect(cleanBaseModel('RANGER 3 SSM HIGH GVM')).toBe('RANGER');
  });

  it('drops a platform code when a real model word survives', () => {
    expect(cleanBaseModel('D23 Navara')).toBe('Navara');
    expect(cleanBaseModel('D27 Navara HD')).toBe('Navara');
    expect(cleanBaseModel('Y62 PATROL NB1 WAGON')).toBe('PATROL');
  });

  it('keeps a platform code when it is the only useful signal', () => {
    expect(cleanBaseModel('RG1')).toBe('RG1');
    expect(cleanBaseModel('D-Max RG1 6x4 HD')).toBe('D-Max');
  });

  it('preserves a hyphenated model name rather than collapsing it', () => {
    expect(cleanBaseModel('D-Max RG1')).toBe('D-Max');
  });

  it('preserves the original casing of surviving tokens', () => {
    expect(cleanBaseModel('hilux 8gen ssm')).toBe('hilux');
    expect(cleanBaseModel('HILUX 8GEN SSM')).toBe('HILUX');
  });

  it('returns null for empty / blank / nullish input', () => {
    expect(cleanBaseModel(null)).toBeNull();
    expect(cleanBaseModel(undefined)).toBeNull();
    expect(cleanBaseModel('   ')).toBeNull();
  });

  it('falls back to the original model when cleaning would empty it', () => {
    // Every token is noise → keep the original rather than returning "".
    expect(cleanBaseModel('2 AXLE OMNIBUS')).toBe('2 AXLE OMNIBUS');
  });
});
