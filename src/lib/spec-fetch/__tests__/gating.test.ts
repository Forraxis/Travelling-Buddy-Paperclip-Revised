import { describe, it, expect } from 'vitest';
import {
  evaluatePromotionGate,
  effectiveValue,
  type GateableField,
} from '../gating';

describe('effectiveValue', () => {
  it('prefers a non-empty admin value over the provider value', () => {
    expect(
      effectiveValue({ field: 'gvmKg', value: '3000', adminValue: '3260' }),
    ).toBe('3260');
  });
  it('falls back to the provider value when admin value is empty/absent', () => {
    expect(effectiveValue({ field: 'gvmKg', value: '3000' })).toBe('3000');
    expect(
      effectiveValue({ field: 'gvmKg', value: '3000', adminValue: '' }),
    ).toBe('3000');
  });
});

describe('evaluatePromotionGate', () => {
  const baseFields: GateableField[] = [
    { field: 'gvmKg', value: '3260', corroborated: true },
    { field: 'frontAxleLimitKg', value: '1480', corroborated: false },
    { field: 'kerbWeightKg', value: '2510', corroborated: false }, // soft → never blocks
  ];

  it('blocks an uncorroborated critical field without override', () => {
    const r = evaluatePromotionGate(baseFields, false);
    expect(r.allowed).toBe(false);
    expect(r.requiresOverride).toBe(true);
    expect(r.blockingFields).toContain('frontAxleLimitKg');
    // soft field never blocks
    expect(r.blockingFields).not.toContain('kerbWeightKg');
    // corroborated critical field never blocks
    expect(r.blockingFields).not.toContain('gvmKg');
  });

  it('allows promotion when an override is supplied', () => {
    const r = evaluatePromotionGate(baseFields, true);
    expect(r.allowed).toBe(true);
    expect(r.requiresOverride).toBe(true);
    expect(r.blockingFields).toContain('frontAxleLimitKg');
  });

  it('needs no override when every critical field is corroborated or null', () => {
    const r = evaluatePromotionGate(
      [
        { field: 'gvmKg', value: '3260', corroborated: true },
        { field: 'frontAxleLimitKg', value: null, corroborated: false },
      ],
      false,
    );
    expect(r.allowed).toBe(true);
    expect(r.requiresOverride).toBe(false);
    expect(r.blockingFields).toHaveLength(0);
  });

  it('treats a corroborating admin value as satisfying the gate only via the corroborated flag, not the value alone', () => {
    // An admin can EDIT the value but until they tick corroborated it still blocks.
    const r = evaluatePromotionGate(
      [
        {
          field: 'gcmKg',
          value: '6500',
          adminValue: '6760',
          corroborated: false,
        },
      ],
      false,
    );
    expect(r.allowed).toBe(false);
    expect(r.blockingFields).toContain('gcmKg');
  });
});
