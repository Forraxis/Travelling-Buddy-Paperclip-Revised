/**
 * @deprecated The real pipeline maps figures structurally in `variant-fields.ts`
 *   (RvdVariant → candidate field), not by row label. Retained for reference only —
 *   no longer registered or run. See ROVER_OVERNIGHT_BUILD.md Phase 4.
 *
 * Map a ROVER consumer-report row label → a canonical VehicleSpecFieldKey.
 *
 * This is the single piece most likely to change once a real consumer-report
 * sample lands (label wording, units, footnotes), so it is isolated here and
 * pattern-driven. The synthetic fixture uses representative labels; widen the
 * patterns when the real document arrives. Order matters — the first matching
 * pattern wins, so put the more specific patterns first (axle/combination before
 * the bare "mass").
 */
import type { VehicleSpecFieldKey } from '../types';

interface LabelPattern {
  field: VehicleSpecFieldKey;
  /** Case-insensitive test against the normalised label. */
  pattern: RegExp;
}

/**
 * Patterns are tested against a lower-cased, whitespace-collapsed label. The more
 * specific compound figures (combination, axle) precede the bare "vehicle mass"
 * so "gross combination mass" can't be mis-bucketed as GVM.
 */
const LABEL_PATTERNS: readonly LabelPattern[] = [
  { field: 'gcmKg', pattern: /gross combination mass|\bgcm\b/ },
  { field: 'gvmKg', pattern: /gross vehicle mass|\bgvm\b/ },
  {
    field: 'frontAxleLimitKg',
    pattern: /front axle.*(mass|capacity|rating|limit|gawr)|front gawr/,
  },
  {
    field: 'rearAxleLimitKg',
    pattern: /rear axle.*(mass|capacity|rating|limit|gawr)|rear gawr/,
  },
  {
    field: 'maxTowingCapacityKg',
    pattern: /braked tow|maximum braked|towing capacity|braked trailer/,
  },
  {
    field: 'maxTowBallDownloadKg',
    pattern: /tow.?ball|ball load|coupling.*(mass|download)|download/,
  },
  { field: 'kerbWeightKg', pattern: /\btare\b|kerb mass|unladen/ },
  { field: 'fuelTankCapacityL', pattern: /fuel tank|tank capacity/ },
  { field: 'fuelType', pattern: /fuel type|engine fuel/ },
];

/** Normalise a raw label for matching: lower-case + collapse whitespace. */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a document label to a field key, or null when it matches nothing we map
 * (an unmapped row is simply ignored — it never invents a field).
 */
export function fieldForLabel(label: string): VehicleSpecFieldKey | null {
  const norm = normalizeLabel(label);
  for (const { field, pattern } of LABEL_PATTERNS) {
    if (pattern.test(norm)) return field;
  }
  return null;
}

/**
 * Pull the leading numeric figure out of a report value cell, e.g. "3,500 kg" →
 * "3500", "350 kg max" → "350". Returns null when there is no number (so a "N/A"
 * or "-" cell becomes a null field, not a zero). For non-numeric fields (fuelType)
 * the raw trimmed value is returned untouched by the caller.
 */
export function extractNumeric(value: string): string | null {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return match[0];
}
