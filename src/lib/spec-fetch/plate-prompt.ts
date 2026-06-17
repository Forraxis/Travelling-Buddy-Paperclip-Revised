/**
 * SCAFFOLD (Phase 7) — the contextual plate-prompt decision, the one piece of
 * the user-trust path that is safe + pure + testable now. Everything else in the
 * trust path is config + TODO (see ./trust-config.ts).
 *
 * Principle (settled): don't blanket-prompt for a compliance-plate photo. Ask
 * just-in-time, framed as upgrading the user's OWN verdict — only when
 * uncertainty × proximity is high: the rig is NEAR a limit AND that limit is the
 * estimated/low-confidence one. Value-first, never gate the calculator behind a
 * photo. See vehicle-data-fetch-design.md.
 *
 * NOT yet wired into the calculator UI — that's the remaining build (see TODO in
 * VEHICLE_DATA_FETCH.md). This decides *whether* to prompt; the UI decides *how*.
 */
import {
  DEFAULT_SPEC_TRUST_CONFIG,
  type SpecTrustConfig,
} from './trust-config';
import type { ComplianceLimitKey } from '@/lib/physics/types';

export interface MetricProximity {
  key: ComplianceLimitKey;
  /** actual / limit for this metric (e.g. 0.97 = 97% of the limit). */
  usageRatio: number;
  /** Is the limit driving this metric estimated/unverified? */
  limitEstimated: boolean;
}

export interface PlatePromptDecision {
  shouldPrompt: boolean;
  /** The metric that triggered the prompt (the closest estimated limit), or null. */
  reasonMetric: ComplianceLimitKey | null;
}

/**
 * Decide whether to surface a plate prompt for a single metric: only when its
 * limit is estimated AND the rig is at/over the proximity threshold.
 */
export function shouldPromptForMetric(
  m: MetricProximity,
  config: SpecTrustConfig = DEFAULT_SPEC_TRUST_CONFIG,
): boolean {
  if (!m.limitEstimated) return false;
  return m.usageRatio >= config.platePromptProximityRatio;
}

/**
 * Across all of a result's compliance metrics, decide whether to prompt and for
 * which one — the closest-to-its-limit estimated metric wins (highest stakes).
 */
export function decidePlatePrompt(
  metrics: MetricProximity[],
  config: SpecTrustConfig = DEFAULT_SPEC_TRUST_CONFIG,
): PlatePromptDecision {
  const candidates = metrics
    .filter((m) => shouldPromptForMetric(m, config))
    .sort((a, b) => b.usageRatio - a.usageRatio);
  return candidates.length > 0
    ? { shouldPrompt: true, reasonMetric: candidates[0].key }
    : { shouldPrompt: false, reasonMetric: null };
}
