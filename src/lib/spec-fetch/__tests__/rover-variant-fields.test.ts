import { describe, it, expect } from 'vitest';
import { roverVariantFields } from '../rover/variant-fields';
import { draftGateableFields } from '../rover/verifier';
import { evaluatePromotionGate } from '../gating';
import type { RvdVariant } from '../rover/rvd-parser';

const NAVARA_STX: RvdVariant = {
  name: 'DC PU 2WD AT ST-X (#030)',
  variantCode: '030',
  bodyStyle: 'Utility',
  tareKg: 1925,
  gvmKg: 3070,
  gcmKg: null, // RVD leaves GCM blank
  towBrakedKg: 3500,
  towUnbrakedKg: 750,
  lengthMm: 5260,
  widthMm: 1850,
  heightMm: 1840,
  wheelbaseMm: 3150,
  runningClearanceMm: 220,
  seatingOptions: '5',
  axleCode: '2 Axles',
};

describe('roverVariantFields', () => {
  it('maps the published per-variant figures to catalogue fields', () => {
    const byKey = Object.fromEntries(
      roverVariantFields(NAVARA_STX).map((f) => [f.field, f]),
    );
    expect(byKey.gvmKg.value).toBe('3070');
    expect(byKey.maxTowingCapacityKg.value).toBe('3500');
    expect(byKey.kerbWeightKg.value).toBe('1925'); // tare → kerb
    expect(byKey.wheelbaseMm.value).toBe('3150');
    expect(byKey.totalLengthMm.value).toBe('5260');
  });

  it('auto-corroborates present figures; GCM stays null + uncorroborated', () => {
    const byKey = Object.fromEntries(
      roverVariantFields(NAVARA_STX).map((f) => [f.field, f]),
    );
    expect(byKey.gvmKg.corroborated).toBe(true);
    expect(byKey.gvmKg.isComplianceCritical).toBe(true);
    // GCM not published in the RVD → null, never 0, never corroborated.
    expect(byKey.gcmKg.value).toBeNull();
    expect(byKey.gcmKg.corroborated).toBe(false);
  });

  it('clears the promotion gate with no override (structured-parse trust)', () => {
    const gate = evaluatePromotionGate(
      draftGateableFields({
        ref: {} as never,
        parserId: 'rvd-parser',
        extractionConfidence: 1,
        raw: null,
        fields: roverVariantFields(NAVARA_STX).map((f) => ({
          field: f.field,
          value: f.value,
          sourceUrl: 'rover',
          sourceLabel: 'rvd',
          isComplianceCritical: f.isComplianceCritical,
          corroborated: f.corroborated,
        })),
      }),
      false,
    );
    expect(gate.allowed).toBe(true);
    expect(gate.blockingFields).toEqual([]);
  });
});
