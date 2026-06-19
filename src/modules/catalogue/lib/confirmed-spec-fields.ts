/**
 * Display metadata for the public confirmed-spec page fields (P9).
 * Pure, no DB — labels + unit-aware formatting for a provenance string value.
 */
import type { SpecProvenanceSource } from '@prisma/client';
import type { ConfirmedSpecField } from '../queries/confirmed-spec.queries';

interface FieldMeta {
  /** Long column / row label. */
  label: string;
  /** Short header label for the variant table. */
  short: string;
  unit: 'kg' | 'mm';
}

export const CONFIRMED_FIELD_META: Record<ConfirmedSpecField, FieldMeta> = {
  gvmKg: { label: 'GVM (gross vehicle mass)', short: 'GVM', unit: 'kg' },
  gcmKg: { label: 'GCM (gross combination mass)', short: 'GCM', unit: 'kg' },
  maxTowingCapacityKg: {
    label: 'Maximum braked towing capacity',
    short: 'Max towing',
    unit: 'kg',
  },
  maxTowBallDownloadKg: {
    label: 'Maximum tow-ball download',
    short: 'Tow-ball',
    unit: 'kg',
  },
  kerbWeightKg: { label: 'Kerb (tare) mass', short: 'Kerb', unit: 'kg' },
  frontAxleLimitKg: {
    label: 'Front axle limit',
    short: 'Front axle',
    unit: 'kg',
  },
  rearAxleLimitKg: { label: 'Rear axle limit', short: 'Rear axle', unit: 'kg' },
  wheelbaseMm: { label: 'Wheelbase', short: 'Wheelbase', unit: 'mm' },
  frontOverhangMm: { label: 'Front overhang', short: 'Front OH', unit: 'mm' },
  rearOverhangMm: { label: 'Rear overhang', short: 'Rear OH', unit: 'mm' },
  totalLengthMm: { label: 'Overall length', short: 'Length', unit: 'mm' },
};

/**
 * Format a provenance string value with its unit. The value is a canonical
 * integer string; a non-numeric value is rendered verbatim (defensive — the
 * read-model only publishes numeric Tier-A fields, but never throw on bad data).
 */
export function formatConfirmedValue(
  field: ConfirmedSpecField,
  value: string,
): string {
  const meta = CONFIRMED_FIELD_META[field];
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString()} ${meta.unit}`;
}

/** Human label for a provenance source, used in the "sourced from …" stamp. */
export function sourceLabel(source: SpecProvenanceSource): string {
  switch (source) {
    case 'ROVER':
      return 'ROVER (federal RVSA approval)';
    case 'PLATE':
      return 'compliance plate';
    case 'COMMUNITY':
      return 'community-confirmed';
    case 'MANUAL':
      return 'verified entry';
    case 'CLAUDE':
      // Should never reach the public page (CLAUDE = ESTIMATE), but label safely.
      return 'verified source';
    default:
      return 'verified source';
  }
}
