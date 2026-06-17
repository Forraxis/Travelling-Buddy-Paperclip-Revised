/**
 * Turn a raw, Zod-validated provider response into the canonical FetchedField[]
 * the rest of the pipeline persists. Enforces the two invariants that matter:
 *  1. null-not-guess — a missing value stays null, never coerced to 0.
 *  2. only catalogue fields survive — a chatty model inventing extra keys can't
 *     pollute the candidate.
 */
import { SPEC_FIELD_BY_KEY } from './fields';
import type {
  FetchedField,
  ProviderResponse,
  VehicleSpecFieldKey,
} from './types';

/** Canonical string form of a value, or null. Empty string → null. */
function canonicalValue(
  raw: number | string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? String(raw) : null;
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

export function normalizeProviderResponse(
  parsed: ProviderResponse,
): FetchedField[] {
  const out: FetchedField[] = [];
  for (const [key, field] of Object.entries(parsed.fields)) {
    const def = SPEC_FIELD_BY_KEY[key];
    if (!def) continue; // drop unknown keys
    const value = canonicalValue(field.value);
    out.push({
      field: def.key as VehicleSpecFieldKey,
      value,
      // A null value carries no confidence — the model found nothing to rate.
      confidence: value === null ? null : (field.confidence ?? null),
      sourceUrl: field.sourceUrl ?? null,
    });
  }
  return out;
}
