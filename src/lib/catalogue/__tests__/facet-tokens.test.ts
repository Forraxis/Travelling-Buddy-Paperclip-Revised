import { describe, expect, it } from 'vitest';
import {
  deriveDrive,
  deriveCab,
  deriveBadge,
  deriveTransmission,
  deriveGeneration,
  cleanVehicleName,
  looksCryptic,
  parseVehicleQuery,
  parseCaravanQuery,
  bodyFeetHalf,
  formatFeet,
  driveTypeToDbLabel,
  driveTypeFromDbLabel,
} from '../facet-tokens';

describe('deriveDrive', () => {
  it('reads ute drivetrain tokens with 4x4 > AWD > 4x2 precedence', () => {
    expect(deriveDrive('DC PU 4WD AT ST-X')).toBe('FOUR_WHEEL_DRIVE');
    expect(deriveDrive('Dual Cab 4x2 Auto')).toBe('TWO_WHEEL_DRIVE');
    expect(deriveDrive('Wagon 2.0 AWD')).toBe('ALL_WHEEL_DRIVE');
    expect(deriveDrive('GLX 4MATIC')).toBe('ALL_WHEEL_DRIVE');
  });
  it('leaves plain passenger names null (no 4x2 mislabel)', () => {
    expect(deriveDrive('2.5 Touring')).toBeNull();
    expect(deriveDrive('Dual Cab 2015–2020')).toBeNull();
  });
});

describe('deriveCab', () => {
  it('maps explicit cab forms', () => {
    expect(deriveCab('Dual Cab 2007')?.cab).toBe('DUAL_CAB');
    expect(deriveCab('King Cab Ute')?.cab).toBe('KING_CAB');
    expect(deriveCab('Single Cab Chassis')?.cab).toBe('SINGLE_CAB');
    expect(deriveCab('Wagon 2019')?.cab).toBe('WAGON');
  });
  it('uses short ROVER codes at LOW confidence', () => {
    expect(deriveCab('DC PU 4WD AT SL')).toEqual({
      cab: 'DUAL_CAB',
      conf: 'LOW',
    });
  });
  it('returns null for ambiguous bodies (Ute / Cab Chassis alone)', () => {
    expect(deriveCab('Ute 2008–2014')).toBeNull();
    expect(deriveCab('Cab Chassis 2015')).toBeNull();
  });
});

describe('deriveBadge', () => {
  it('extracts the trim after the ROVER transmission token', () => {
    expect(deriveBadge('DC PU 4WD AT ST-X (#054)')).toBe('ST-X');
    expect(deriveBadge('DC PU 4WD AT PRO-4X (#060)')).toBe('PRO-4X');
    expect(deriveBadge('SC CC 2WD MT SL (#063)')).toBe('SL');
  });
  it('matches known grades anywhere, longest-first', () => {
    expect(deriveBadge('SR5 Auto 4x4')).toBe('SR5');
    expect(deriveBadge('Some ST-X variant')).toBe('ST-X'); // not "ST"
  });
  it('returns null when there is no trim', () => {
    expect(deriveBadge('Dual Cab 2015–2020')).toBeNull();
    expect(deriveBadge('LM2TJLBPDR8')).toBeNull();
  });
});

describe('deriveTransmission', () => {
  it('reads AT/MT and words', () => {
    expect(deriveTransmission('DC PU 4WD AT ST-X')).toBe('Auto');
    expect(deriveTransmission('DC PU 4WD MT SL')).toBe('Manual');
    expect(deriveTransmission('SR5 Automatic')).toBe('Auto');
  });
  it('is null when absent', () => {
    expect(deriveTransmission('Dual Cab 2015–2020')).toBeNull();
  });
});

describe('deriveGeneration', () => {
  it('assigns when exactly one span matches', () => {
    expect(deriveGeneration('HiLux', 2018, 2020)).toBe('N80');
    expect(deriveGeneration('Ranger', 2014, 2021)).toBe('PX');
  });
  it('is null at an overlapping boundary or unknown model', () => {
    expect(deriveGeneration('HiLux', 2015, 2015)).toBeNull(); // N70/N80 boundary
    expect(deriveGeneration('Navara', 2008, 2008)).toBeNull(); // not in table
  });
});

describe('cleanVehicleName', () => {
  const facets = {
    badge: 'ST-X',
    cabType: 'DUAL_CAB',
    driveType: 'FOUR_WHEEL_DRIVE',
    transmission: 'Auto',
  };
  it('rewrites cryptic ROVER codes from facets', () => {
    expect(
      cleanVehicleName({ name: 'DC PU 4WD AT ST-X (#054)', ...facets }),
    ).toBe('ST-X Dual Cab 4x4 Auto');
  });
  it('disambiguates AT vs MT', () => {
    expect(
      cleanVehicleName({
        name: 'DC PU 4WD MT ST-X (#051)',
        ...facets,
        transmission: 'Manual',
      }),
    ).toBe('ST-X Dual Cab 4x4 Manual');
  });
  it('keeps readable names (no info loss)', () => {
    expect(
      cleanVehicleName({ name: 'Dual Cab 2015–2020', cabType: 'DUAL_CAB' }),
    ).toBe('Dual Cab 2015–2020');
    expect(
      cleanVehicleName({
        name: 'Double Cab Utility PHEV Platinum 4WD',
        cabType: 'DUAL_CAB',
        driveType: 'FOUR_WHEEL_DRIVE',
      }),
    ).toBe('Double Cab Utility PHEV Platinum 4WD');
  });
  it('falls back to raw when a code has no facets', () => {
    expect(cleanVehicleName({ name: 'LM2TJLBPDR8' })).toBe('LM2TJLBPDR8');
  });
});

describe('looksCryptic', () => {
  it('flags ROVER approval ids, body codes and bare codes', () => {
    expect(looksCryptic('DC PU 4WD AT ST-X (#054)')).toBe(true);
    expect(looksCryptic('LM2TJLBPDR8')).toBe(true);
    expect(looksCryptic('GUN125R-BTFLXQ3')).toBe(true);
  });
  it('does not flag clean names', () => {
    expect(looksCryptic('ST-X Dual Cab 4x4 Auto')).toBe(false);
    expect(looksCryptic('Dual Cab 2015–2020')).toBe(false);
  });
  it('does NOT flag single-word trim names (no digit)', () => {
    expect(looksCryptic('PLATINUM')).toBe(false);
    expect(looksCryptic('WILDTRAK')).toBe(false);
    expect(looksCryptic('SAHARA')).toBe(false);
    expect(looksCryptic('AMBIENTE')).toBe(false);
  });
});

describe('driveType @map round-trip', () => {
  it('maps Prisma member ↔ DB label', () => {
    expect(driveTypeToDbLabel('FOUR_WHEEL_DRIVE')).toBe('4X4');
    expect(driveTypeFromDbLabel('4X2')).toBe('TWO_WHEEL_DRIVE');
    expect(driveTypeFromDbLabel(null)).toBeNull();
  });
});

describe('parseVehicleQuery', () => {
  it('pulls facets + year out, leaving the nameplate remainder', () => {
    expect(parseVehicleQuery('navara 4x4 dual cab')).toMatchObject({
      driveType: 'FOUR_WHEEL_DRIVE',
      cabType: 'DUAL_CAB',
      remainder: 'navara',
    });
  });
  it('parses a year (the 2008↔200x trigram bug fix)', () => {
    const r = parseVehicleQuery('navara 2008');
    expect(r.year).toBe(2008);
    expect(r.remainder).toBe('navara');
  });
  it('combines year + facets', () => {
    expect(parseVehicleQuery('navara 2008 dual cab')).toMatchObject({
      year: 2008,
      cabType: 'DUAL_CAB',
      remainder: 'navara',
    });
  });
});

describe('parseCaravanQuery', () => {
  it('parses berths', () => {
    expect(parseCaravanQuery('jayco journey 6 berth')).toMatchObject({
      berths: 6,
      remainder: 'jayco journey',
    });
  });
  it('parses body length in several notations', () => {
    expect(parseCaravanQuery("nova revivor 16'6").lengthFt).toBe(16.5);
    expect(parseCaravanQuery('jayco 17ft6').lengthFt).toBe(17.5);
    expect(parseCaravanQuery('coromal 18.5').lengthFt).toBe(18.5);
  });
  it('reads 4-digit year as a year, not a length', () => {
    const r = parseCaravanQuery('nova revivor 2012');
    expect(r.year).toBe(2012);
    expect(r.lengthFt).toBeUndefined();
    expect(r.remainder).toBe('nova revivor');
  });
});

describe('bodyFeetHalf / formatFeet', () => {
  it('rounds mm to the nearest half-foot', () => {
    expect(bodyFeetHalf(5029)).toBe(16.5);
    expect(bodyFeetHalf(5486)).toBe(18);
    expect(bodyFeetHalf(5330)).toBe(17.5);
    expect(bodyFeetHalf(null)).toBeNull();
  });
  it('formats AU feet+inches', () => {
    expect(formatFeet(16.5)).toBe(`16'6"`);
    expect(formatFeet(18)).toBe(`18'0"`);
    expect(formatFeet(null)).toBeNull();
  });
});
