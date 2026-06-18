/**
 * Map one parsed RVD variant → the candidate fields the calculator's VehicleVariant
 * can hold. Pure + tested without a DB.
 *
 * Only the fields ROVER actually publishes per variant are mapped: GVM, tare (→ kerb),
 * braked towing, wheelbase, length. Present values are **auto-corroborated** (parsed
 * from the government document, no LLM transcription — VEHICLE_DATA_FETCH.md §1).
 * GCM is mapped but is null in practice (RVD leaves it blank). Front/rear axle limits
 * are deliberately NOT mapped here — they aren't published per variant and stay on the
 * plate path. null = "not stated", never 0.
 */
import { isComplianceCriticalField } from '../fields';
import type { VehicleSpecFieldKey } from '../types';
import type { RvdVariant } from './rvd-parser';

export interface RoverVariantField {
  field: VehicleSpecFieldKey;
  /** Canonical string value, or null when the RVD doesn't state it. */
  value: string | null;
  isComplianceCritical: boolean;
  /** Structured-parse auto-corroboration: true iff a value is present. */
  corroborated: boolean;
}

/** (RVD variant key → canonical VehicleVariant column). */
const MAPPING: ReadonlyArray<[keyof RvdVariant, VehicleSpecFieldKey]> = [
  ['gvmKg', 'gvmKg'],
  ['gcmKg', 'gcmKg'],
  ['towBrakedKg', 'maxTowingCapacityKg'],
  ['tareKg', 'kerbWeightKg'],
  ['wheelbaseMm', 'wheelbaseMm'],
  ['lengthMm', 'totalLengthMm'],
];

export function roverVariantFields(variant: RvdVariant): RoverVariantField[] {
  return MAPPING.map(([src, field]) => {
    const raw = variant[src];
    const value = typeof raw === 'number' ? String(raw) : null;
    return {
      field,
      value,
      isComplianceCritical: isComplianceCriticalField(field),
      corroborated: value !== null,
    };
  });
}
