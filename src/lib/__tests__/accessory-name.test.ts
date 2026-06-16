import { describe, it, expect } from 'vitest';
import { accessoryDisplayName } from '../accessory-name';

describe('accessoryDisplayName', () => {
  it('does not double the brand when the name already starts with it', () => {
    expect(
      accessoryDisplayName('ARB', 'ARB Summit Bullbar – Toyota HiLux'),
    ).toBe('ARB Summit Bullbar – Toyota HiLux');
  });

  it('prefixes the brand when the name omits it', () => {
    expect(accessoryDisplayName('Rhino-Rack', 'Pioneer Platform')).toBe(
      'Rhino-Rack Pioneer Platform',
    );
  });

  it('is case-insensitive on the prefix match', () => {
    expect(accessoryDisplayName('arb', 'ARB Bull Bar')).toBe('ARB Bull Bar');
  });

  it('handles a missing brand or name gracefully', () => {
    expect(accessoryDisplayName(null, 'Bull Bar')).toBe('Bull Bar');
    expect(accessoryDisplayName('ARB', '')).toBe('ARB');
    expect(accessoryDisplayName(undefined, undefined)).toBe('');
  });
});
