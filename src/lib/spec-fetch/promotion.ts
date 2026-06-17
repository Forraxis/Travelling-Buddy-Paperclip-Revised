/**
 * Pure mapping from candidate fields → a VehicleVariant data patch. Parses the
 * canonical string values into the typed columns (int / fuelType enum), applying
 * the admin override value when present. Null/absent values are simply omitted so
 * a promotion never overwrites an existing column with a guess.
 *
 * Kept pure (no Prisma) so it's unit-tested without a DB; the server action wraps
 * it in the transaction that resolves make/model + writes the variant.
 */
import { SPEC_FIELD_BY_KEY } from './fields';
import { effectiveValue, type GateableField } from './gating';
import type { FuelType } from '@prisma/client';

const FUEL_TYPES: readonly FuelType[] = [
  'DIESEL',
  'PETROL',
  'HYBRID',
  'ELECTRIC',
];

/** A VehicleVariant column subset a promotion can write. */
export type VariantSpecPatch = Partial<{
  gvmKg: number;
  gcmKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  maxTowingCapacityKg: number;
  maxTowBallDownloadKg: number;
  kerbWeightKg: number;
  wheelbaseMm: number;
  frontOverhangMm: number;
  rearOverhangMm: number;
  totalLengthMm: number;
  fuelTankCapacityL: number;
  fuelType: FuelType;
}>;

function parseInt0(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function parseFuelType(value: string): FuelType | null {
  const up = value.trim().toUpperCase();
  return (FUEL_TYPES as readonly string[]).includes(up)
    ? (up as FuelType)
    : null;
}

/**
 * Build the VehicleVariant patch from candidate fields. Unknown / null / unparsable
 * values are skipped. Returns the patch plus the list of skipped fields (for the
 * admin to see what didn't make it).
 */
export function buildVariantPatch(fields: GateableField[]): {
  patch: VariantSpecPatch;
  skipped: string[];
} {
  const patch: VariantSpecPatch = {};
  const skipped: string[] = [];
  for (const f of fields) {
    const def = SPEC_FIELD_BY_KEY[f.field];
    if (!def) {
      skipped.push(f.field);
      continue;
    }
    const value = effectiveValue(f);
    if (value === null) continue; // nothing to write — leave column untouched

    if (def.kind === 'enum') {
      const parsed = parseFuelType(value);
      if (parsed === null) {
        skipped.push(f.field);
        continue;
      }
      (patch as Record<string, unknown>)[def.key] = parsed;
    } else {
      const parsed = parseInt0(value);
      if (parsed === null) {
        skipped.push(f.field);
        continue;
      }
      (patch as Record<string, unknown>)[def.key] = parsed;
    }
  }
  return { patch, skipped };
}
