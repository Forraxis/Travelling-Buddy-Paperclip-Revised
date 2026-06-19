import { describe, it, expect, beforeEach } from 'vitest';
import { RoverMakeNormalizer } from '../rover/normalize';

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

  it('passes a clean factory make straight through', () => {
    expect(n.normalize('NISSAN', 'D23 Navara')).toEqual({
      baseMake: 'Nissan',
      baseModel: 'D23 Navara',
      modifier: null,
      isSecondStage: false,
      status: 'AUTO',
    });
  });

  it('recovers base make from the MODEL when the make is a pure modifier (Premcar → Nissan)', () => {
    const r = n.normalize('PREMCAR', 'D23 Navara');
    expect(r.baseMake).toBe('Nissan');
    expect(r.baseModel).toBe('D23 Navara');
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
});
