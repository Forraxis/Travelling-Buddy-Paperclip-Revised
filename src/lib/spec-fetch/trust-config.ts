/**
 * SCAFFOLD (Phase 7) — conservative-default config for the user-trust + plate
 * path of the vehicle-data pipeline. The *policy shape* is settled (see
 * vehicle-data-fetch-design.md); the **numeric thresholds are placeholders that
 * need Tim's sign-off** (Rule 11 where they touch corroboration of measured
 * fields). Nothing here is wired into live promotion yet — it documents the
 * intended model and gives the testable pieces (see ./plate-prompt.ts) a home.
 *
 * Reuses the P3 calibration moat for soft-field consensus rather than building a
 * parallel trust system — see src/lib/physics/calibration-contribution.ts
 * (MIN_SAMPLES, collapseByFingerprint, weightedMedian, aggregateCorrection) and
 * src/app/admin/moderation/calibrations/.
 */
import { MIN_SAMPLES } from '@/lib/physics/calibration-contribution';
import type { TrustTier } from '@prisma/client';

export interface SpecTrustConfig {
  // ── Blast radius ──────────────────────────────────────────────────────────
  /**
   * A user-submitted value affects ONLY that user's own rig until it is
   * promoted. A bad actor poisons only their own verdict. (Settled policy.)
   */
  userValuesPersonalUntilPromoted: boolean;

  // ── Promotion rules ───────────────────────────────────────────────────────
  /**
   * A compliance-critical nameplate field promotes to shared/CATALOGUE ONLY via
   * a plate-photo (VLM-confirmed) OR an admin/moderator tick — never headcount
   * consensus. One plate beats "3 users agreed". (Settled policy; enforced today
   * by ./gating.ts at the admin step.)
   */
  criticalRequiresPlateOrAdmin: boolean;
  /**
   * Soft/measured fields use the moat's dedup'd, trust-weighted robust median.
   * Min distinct contributors before a soft value can publish. Reuses the moat
   * constant so the two systems can't drift.
   */
  softFieldMinSamples: number;

  // ── Anti-abuse ────────────────────────────────────────────────────────────
  /** One contributor = one vote (dedup by the moat's duplicateFingerprint). */
  oneContributorOneVote: boolean;
  /**
   * Trust-tier weighting for soft-field consensus. NEW counts for nothing until
   * it earns trust. ⚠️ TODO(tim): these weights are a conservative placeholder —
   * sign off the actual values (they shape which crowd values win).
   */
  trustTierWeights: Record<TrustTier, number>;
  /**
   * A new submission never silently overwrites a corroborated value — it opens a
   * dispute for review instead. (Settled policy.)
   */
  newSubmissionNeverOverwritesCorroborated: boolean;

  // ── Contextual plate prompt (uncertainty × proximity) ─────────────────────
  /**
   * Ask for a plate photo only when the rig is NEAR a limit AND that limit is the
   * estimated/low-confidence one. This ratio is the "near" threshold (actual /
   * limit). ⚠️ TODO(tim): confirm — too low spams every user, too high misses
   * people who should verify.
   */
  platePromptProximityRatio: number;
}

/**
 * Conservative defaults. The booleans encode settled policy; every NUMBER is a
 * placeholder pending Tim's sign-off (marked TODO(tim) above).
 */
export const DEFAULT_SPEC_TRUST_CONFIG: SpecTrustConfig = {
  userValuesPersonalUntilPromoted: true,

  criticalRequiresPlateOrAdmin: true,
  softFieldMinSamples: MIN_SAMPLES, // reuse the moat (3) — TODO(tim) confirm for specs

  oneContributorOneVote: true,
  trustTierWeights: {
    NEW: 0, // earns nothing until it levels up
    BASIC: 1,
    TRUSTED: 2,
    EXPERT: 3,
  },
  newSubmissionNeverOverwritesCorroborated: true,

  platePromptProximityRatio: 0.9, // within 10% of the limit — TODO(tim)
};
