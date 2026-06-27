import { describe, it, expect } from 'vitest';
import { extractVin, wmiToCountry, vinToBuildOrigin } from '../vin';
import {
  parseVehicleQuery,
  formatOrigin,
  deriveOriginToken,
} from '../facet-tokens';

describe('VIN extraction', () => {
  it('pulls a 17-char VIN out of noisy plate text', () => {
    expect(extractVin('MAKE NISSAN  VIN: VSKDVUD40U0123456  GVM 2855KG')).toBe(
      'VSKDVUD40U0123456',
    );
  });
  it('returns null when no 17-char VIN is present', () => {
    expect(extractVin('GVM 2855 GCM 5455 MAKE NISSAN')).toBeNull();
  });
  it('ignores I/O/Q (not valid VIN chars) so a 17-run with them is rejected', () => {
    expect(extractVin('IOQIOQIOQIOQIOQIO')).toBeNull();
  });
});

describe('WMI → country of manufacture', () => {
  it('maps the known Nissan plants exactly (the D40 case)', () => {
    expect(wmiToCountry('VSK')).toBe('ES'); // Barcelona
    expect(wmiToCountry('MNT')).toBe('TH'); // Sriracha
  });
  it('falls back to region ranges', () => {
    expect(wmiToCountry('JN1')).toBe('JP'); // Japan (all J)
    expect(wmiToCountry('6FP')).toBe('AU'); // Australia
    expect(wmiToCountry('WDB')).toBe('DE'); // Germany (all W)
    expect(wmiToCountry('VF1')).toBe('FR'); // France
    expect(wmiToCountry('8AD')).toBe('AR'); // Argentina
  });
  it('returns null for an unknown WMI', () => {
    expect(wmiToCountry('Q9Z')).toBeNull();
  });
  it('decodes a full VIN to its build origin', () => {
    expect(vinToBuildOrigin('VSKDVUD40U0123456')).toBe('ES');
    expect(vinToBuildOrigin('MNTBBBD40U0999999')).toBe('TH');
    expect(vinToBuildOrigin(null)).toBeNull();
  });
});

describe('origin display + query parsing', () => {
  it('formats a country code as flag + name', () => {
    expect(formatOrigin('ES')).toBe('🇪🇸 Spain');
    expect(formatOrigin('TH')).toBe('🇹🇭 Thailand');
    expect(formatOrigin(null)).toBeNull();
    expect(formatOrigin('ZZ')).toBe('ZZ'); // unknown passes through
  });
  it('derives a country code from free-text origin tokens', () => {
    expect(deriveOriginToken('barcelona')?.code).toBe('ES');
    expect(deriveOriginToken('sriracha')?.code).toBe('TH');
    expect(deriveOriginToken('navara')).toBeNull();
  });
  it('parses build origin out of a vehicle query + leaves a clean remainder', () => {
    const q = parseVehicleQuery('navara d40 spain dual cab');
    expect(q.buildOrigin).toBe('ES');
    expect(q.cabType).toBe('DUAL_CAB');
    expect(q.remainder).toBe('navara d40');
  });
});
