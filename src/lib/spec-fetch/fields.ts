/**
 * The canonical vehicle-spec field catalogue. Single source of truth for:
 *  - which VehicleVariant columns a fetch can populate,
 *  - their human label / unit / type (for the provider prompt + admin UI),
 *  - and crucially which fields are **compliance-critical** (the Phase-4 gate).
 *
 * "Compliance-critical" = a nameplate figure that decides a towing-compliance
 * verdict (GVM / GCM / axle limits / tow-ball / towing). These demand the exact
 * stamped figure or null — never a tolerance band, never a guess — and cannot be
 * promoted to CATALOGUE uncorroborated (see ./gating.ts).
 *
 * Field keys MUST match the VehicleVariant Prisma column names exactly, so the
 * promotion mapper can write them generically.
 */
import type { VehicleSpecFieldKey } from './types';

export type SpecFieldKind = 'int' | 'enum';

export interface SpecFieldDef {
  /** Canonical VehicleVariant column name. */
  key: VehicleSpecFieldKey;
  /** Human label for prompts + admin UI. */
  label: string;
  /** Unit shown in the UI ('' for none). */
  unit: string;
  kind: SpecFieldKind;
  /** Allowed values for enum fields (e.g. fuelType). */
  enumValues?: readonly string[];
  /**
   * True = nameplate figure that gates a compliance verdict. Demand exact value
   * or null; uncorroborated → cannot promote without an admin override tick.
   */
  isComplianceCritical: boolean;
  /** One-line guidance baked into the provider prompt. */
  hint: string;
}

export const SPEC_FIELDS: readonly SpecFieldDef[] = [
  // ── Compliance-critical nameplate figures ──
  {
    key: 'gvmKg',
    label: 'GVM',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Gross Vehicle Mass — the stamped plate figure, not a GVM-upgrade kit value.',
  },
  {
    key: 'gcmKg',
    label: 'GCM',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Gross Combination Mass — total of vehicle + trailer. Often less than GVM + max towing.',
  },
  {
    key: 'frontAxleLimitKg',
    label: 'Front axle limit',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Maximum front axle load (front GAWR). Hard to source — null unless from an authoritative figure.',
  },
  {
    key: 'rearAxleLimitKg',
    label: 'Rear axle limit',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Maximum rear axle load (rear GAWR). Hard to source — null unless from an authoritative figure.',
  },
  {
    key: 'maxTowingCapacityKg',
    label: 'Max braked towing',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Maximum braked towing capacity.',
  },
  {
    key: 'maxTowBallDownloadKg',
    label: 'Max tow-ball download',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: true,
    hint: 'Maximum tow-ball download (TBM).',
  },

  // ── Soft / geometry / estimate fields ──
  {
    key: 'kerbWeightKg',
    label: 'Kerb weight',
    unit: 'kg',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Kerb / tare mass. Approximation tolerated; show "estimated".',
  },
  {
    key: 'wheelbaseMm',
    label: 'Wheelbase',
    unit: 'mm',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Wheelbase.',
  },
  {
    key: 'frontOverhangMm',
    label: 'Front overhang',
    unit: 'mm',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Front axle to front of vehicle.',
  },
  {
    key: 'rearOverhangMm',
    label: 'Rear overhang',
    unit: 'mm',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Rear axle to rear of vehicle (towball end).',
  },
  {
    key: 'totalLengthMm',
    label: 'Total length',
    unit: 'mm',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Overall vehicle length.',
  },
  {
    key: 'fuelTankCapacityL',
    label: 'Fuel tank capacity',
    unit: 'L',
    kind: 'int',
    isComplianceCritical: false,
    hint: 'Main fuel tank capacity (litres). Sub-tanks excluded unless standard.',
  },
  {
    key: 'fuelType',
    label: 'Fuel type',
    unit: '',
    kind: 'enum',
    enumValues: ['DIESEL', 'PETROL', 'HYBRID', 'ELECTRIC'],
    isComplianceCritical: false,
    hint: 'Fuel type.',
  },
] as const;

/** Fast lookup of a field definition by canonical key. */
export const SPEC_FIELD_BY_KEY: Record<string, SpecFieldDef> =
  Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, f]));

/** All valid field keys. */
export const SPEC_FIELD_KEYS: readonly string[] = SPEC_FIELDS.map((f) => f.key);

/**
 * The compliance-critical field set — the Phase-4 gate's single source of truth.
 * A critical field that is uncorroborated cannot be promoted to CATALOGUE without
 * an explicit admin override.
 */
export const COMPLIANCE_CRITICAL_FIELDS: ReadonlySet<string> = new Set(
  SPEC_FIELDS.filter((f) => f.isComplianceCritical).map((f) => f.key),
);

export function isComplianceCriticalField(key: string): boolean {
  return COMPLIANCE_CRITICAL_FIELDS.has(key);
}
