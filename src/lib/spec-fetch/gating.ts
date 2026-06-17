/**
 * Promotion gating for vehicle-spec candidates (Phase 4).
 *
 * THE RULE: a compliance-critical field (GVM/GCM/axle/tow-ball/towing) that is
 * present but UNCORROBORATED cannot be promoted to CATALOGUE without an explicit
 * admin override. "Corroborated" means an admin ticked it (authoritative source /
 * plate) — NOT the model's self-confidence, which is worthless on an ungrounded
 * model (it rates hallucinations HIGH). See COMPLIANCE_CRITICAL_FIELDS in ./fields.
 *
 * This module is pure (no DB) so it's trivially testable and reusable from both
 * the server action and the UI (to show why a candidate is blocked).
 */
import { isComplianceCriticalField } from './fields';

/** Minimal shape this gate needs from a candidate field (DB row or in-memory). */
export interface GateableField {
  field: string;
  /** Provider value (canonical string) — null = not found. */
  value: string | null;
  /** Admin's reviewed value; overrides `value` when set. */
  adminValue?: string | null;
  /** Admin explicitly corroborated this field (plate / authoritative source). */
  corroborated?: boolean;
}

/** The value that would actually be promoted: admin override wins over provider. */
export function effectiveValue(f: GateableField): string | null {
  if (
    f.adminValue !== null &&
    f.adminValue !== undefined &&
    f.adminValue !== ''
  ) {
    return f.adminValue;
  }
  return f.value;
}

export interface GateResult {
  /** True when promotion is allowed (possibly because override is supplied). */
  allowed: boolean;
  /**
   * Critical fields that have a value but are not corroborated — the reason a
   * candidate is blocked. Empty when nothing is blocking.
   */
  blockingFields: string[];
  /** True when override is REQUIRED to promote (i.e. there are blocking fields). */
  requiresOverride: boolean;
}

/**
 * Evaluate whether a candidate's fields may promote to CATALOGUE.
 *
 * - A critical field with a non-null effective value that is NOT corroborated is
 *   blocking.
 * - A critical field that is null/absent is fine (we simply don't write it).
 * - When there are blocking fields, promotion is allowed ONLY if `hasOverride`.
 */
export function evaluatePromotionGate(
  fields: GateableField[],
  hasOverride: boolean,
): GateResult {
  const blockingFields: string[] = [];
  for (const f of fields) {
    if (!isComplianceCriticalField(f.field)) continue;
    const value = effectiveValue(f);
    if (value === null) continue; // nothing to promote for this field
    if (!f.corroborated) blockingFields.push(f.field);
  }
  const requiresOverride = blockingFields.length > 0;
  return {
    allowed: !requiresOverride || hasOverride,
    blockingFields,
    requiresOverride,
  };
}
