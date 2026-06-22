// P3a — the contribution confirmation ladder. Turns a pool of agreeing owner
// contributions (plate photos + typed corrections) for ONE (variant, field) into
// a resolved catalogue verdict: ESTIMATE / CONFIRMED / DISPUTED, with the
// corroborating count and confidence.
//
// COMPLIANCE-CRITICAL — this module encodes the confirmation POLICY exactly:
//   - A single VLM-vetted AUTHENTIC plate from a TRUSTED/EXPERT contributor
//     (gatekeeper auto_approve) → CONFIRMED directly (trusted-auto-approve).
//   - Otherwise count DISTINCT agreeing contributors (fingerprint dedup, one vote
//     each), where "agree" = values within a small per-field tolerance bucket:
//       1 agreeing  → ESTIMATE (record the contributor)
//       2 agreeing  → ESTIMATE, FLAGGED for human moderation (requiresHumanReview)
//       3+ agreeing → CONFIRMED automatically (escape valve)
//   - Agreeing contributors who DISAGREE beyond tolerance (two clusters) →
//     DISPUTED, always routed to a human, never auto-confirmed.
//
// This module is PURE — no DB / Next / Prisma / I/O imports — so the policy is
// trivially unit-testable and reusable from both the worker and the moderation
// action. Mirrors the style + purity of ../physics/calibration-contribution.ts.

import type { SpecProvenanceStatus, SpecFieldConfidence } from '@prisma/client';

/**
 * The compliance LIMIT fields — the ONLY fields this contribution path may ever
 * write to the shared catalogue. A personal tare/kerb must never masquerade as a
 * confirmed shared spec, so build-variable fields are dropped before they reach
 * the ladder (see ./write-spec-provenance + isCatalogueLimitField).
 */
export const CATALOGUE_LIMIT_FIELDS = [
  'gvmKg',
  'gcmKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'maxTowBallDownloadKg',
  'maxTowingCapacityKg',
] as const;

export type CatalogueLimitField = (typeof CATALOGUE_LIMIT_FIELDS)[number];

const LIMIT_FIELD_SET: ReadonlySet<string> = new Set(CATALOGUE_LIMIT_FIELDS);

/** True only for the six compliance-limit fields written to the catalogue. */
export function isCatalogueLimitField(
  field: string,
): field is CatalogueLimitField {
  return LIMIT_FIELD_SET.has(field);
}

/**
 * Per-field agreement tolerance (kg). Two owners "agree" on a field when their
 * stamped values fall within ±tolerance of each other. These are nameplate
 * figures (exact stamps), so the band is tight — it only absorbs OCR/transcription
 * noise (a transposed digit lands far outside and reads as disagreement), never a
 * genuinely different limit. A field absent here falls back to DEFAULT_TOLERANCE_KG.
 */
export const FIELD_TOLERANCE_KG: Record<CatalogueLimitField, number> = {
  // Larger absolute masses → slightly looser absolute band for OCR slop.
  gvmKg: 25,
  gcmKg: 25,
  maxTowingCapacityKg: 25,
  frontAxleLimitKg: 20,
  rearAxleLimitKg: 20,
  // Tow-ball figures are small and usually round (e.g. 350) — keep tight.
  maxTowBallDownloadKg: 10,
};

const DEFAULT_TOLERANCE_KG = 25;

export function fieldToleranceKg(field: string): number {
  return isCatalogueLimitField(field)
    ? FIELD_TOLERANCE_KG[field]
    : DEFAULT_TOLERANCE_KG;
}

/** ≥3 distinct agreeing contributors auto-confirms (the escape valve). */
export const AUTO_CONFIRM_THRESHOLD = 3;
/** 2 distinct agreeing contributors flags a value into the moderation queue. */
export const FLAG_THRESHOLD = 2;

export type ContributionSource = 'PLATE' | 'COMMUNITY';

/**
 * One prior agreeing contribution for a (variant, field), as the ladder sees it.
 * `fingerprint` is the per-contributor identity (see contributionFingerprint):
 * rows sharing one collapse to a single vote, so the gate counts distinct
 * contributors, not raw rows. A null fingerprint counts as its own contributor
 * (legacy / anonymous).
 */
export interface ContributionVote {
  /** The stamped numeric value this contributor reported for the field. */
  value: number;
  /** Per-contributor identity; null = its own distinct contributor. */
  fingerprint: string | null;
}

/** Metadata about the NEW contribution being resolved. */
export interface NewContribution {
  field: string;
  value: number;
  fingerprint: string | null;
  /** True when this came from a compliance-plate photo (vs a typed correction). */
  isPlate: boolean;
  /** VLM gatekeeper recommendedAction === 'auto_approve' on an authentic plate. */
  gatekeeperAutoApprove: boolean;
  /** The contributor's trust tier at submission time. */
  contributorTier: 'NEW' | 'BASIC' | 'TRUSTED' | 'EXPERT';
}

export interface LadderResolution {
  status: SpecProvenanceStatus; // 'ESTIMATE' | 'CONFIRMED' | 'DISPUTED'
  confidence: SpecFieldConfidence; // 'HIGH' | 'MEDIUM' | 'LOW'
  /** Distinct agreeing contributors backing the WINNING (agreeing) value. */
  corroboratingCount: number;
  /** The value the catalogue should carry (the agreeing-cluster value). */
  value: number;
  source: ContributionSource;
  /** True → this value must be (re)entered into / kept in the moderation queue. */
  requiresHumanReview: boolean;
  /** Why — for notes/audit. */
  reason: string;
}

/** A trusted contributor whose authentic plate the gatekeeper auto-approves. */
function isTrustedAuthenticPlate(c: NewContribution): boolean {
  return (
    c.isPlate &&
    c.gatekeeperAutoApprove &&
    (c.contributorTier === 'TRUSTED' || c.contributorTier === 'EXPERT')
  );
}

/**
 * Collapse a vote pool to DISTINCT contributors (one vote each). Rows sharing a
 * fingerprint keep a single representative; null-fingerprint rows each pass
 * through as their own distinct contributor. This is what makes the gate count
 * contributors, not rows. Mirrors collapseByFingerprint in calibration-contribution.
 */
export function collapseVotes(votes: ContributionVote[]): ContributionVote[] {
  const seen = new Map<string, ContributionVote>();
  const passthrough: ContributionVote[] = [];
  for (const v of votes) {
    if (v.fingerprint == null) {
      passthrough.push(v);
      continue;
    }
    // Keep the first vote per fingerprint — one contributor, one vote.
    if (!seen.has(v.fingerprint)) seen.set(v.fingerprint, v);
  }
  return [...passthrough, ...seen.values()];
}

/**
 * Resolve the catalogue verdict for a (variant, field) given the NEW contribution
 * plus the pool of PRIOR distinct contributions for that field (each already a
 * single vote per contributor, OR raw rows — they are re-collapsed here so this
 * is safe either way).
 *
 * `priorVotes` must NOT include the new contribution; this function folds it in
 * (deduped against priors by fingerprint, so a contributor re-submitting the same
 * field never double-counts).
 */
export function resolveLadder(
  newContribution: NewContribution,
  priorVotes: ContributionVote[],
): LadderResolution {
  const source: ContributionSource = newContribution.isPlate
    ? 'PLATE'
    : 'COMMUNITY';
  const tol = fieldToleranceKg(newContribution.field);

  // Fold the new contribution into the pool, then collapse to distinct
  // contributors. The new vote is appended first so its fingerprint wins as the
  // representative for that contributor.
  const newVote: ContributionVote = {
    value: newContribution.value,
    fingerprint: newContribution.fingerprint,
  };
  const distinct = collapseVotes([newVote, ...priorVotes]);

  // Partition the distinct votes into agreement clusters within tolerance of the
  // new value. The "agreeing" cluster is everyone within ±tol of the new value;
  // anyone outside forms a "dissenting" cluster.
  const agreeing = distinct.filter(
    (v) => Math.abs(v.value - newContribution.value) <= tol,
  );
  const dissenting = distinct.filter(
    (v) => Math.abs(v.value - newContribution.value) > tol,
  );

  const corroboratingCount = agreeing.length;

  // ── Trusted authentic plate → CONFIRMED directly (existing behaviour). ──
  // Honoured even with no prior corroboration: a vetted plate from a trusted
  // owner is itself authoritative for the limit fields. But if other owners
  // actively DISAGREE we still surface the conflict to a human rather than
  // silently overwriting — never auto-confirm over a real dispute.
  if (isTrustedAuthenticPlate(newContribution)) {
    if (dissenting.length > 0) {
      return {
        status: 'DISPUTED',
        confidence: 'LOW',
        corroboratingCount,
        value: newContribution.value,
        source,
        requiresHumanReview: true,
        reason: `Trusted authentic plate disagrees with ${dissenting.length} prior contributor(s) beyond ±${tol}kg`,
      };
    }
    return {
      status: 'CONFIRMED',
      confidence: 'HIGH',
      corroboratingCount,
      value: newContribution.value,
      source,
      requiresHumanReview: false,
      reason: `Trusted ${newContribution.contributorTier} authentic plate (gatekeeper auto_approve)`,
    };
  }

  // ── Disagreement among contributors → DISPUTED, always human. ──
  if (dissenting.length > 0) {
    return {
      status: 'DISPUTED',
      confidence: 'LOW',
      corroboratingCount,
      value: newContribution.value,
      source,
      requiresHumanReview: true,
      reason: `Contributors disagree: ${agreeing.length} agree on ~${newContribution.value}, ${dissenting.length} differ beyond ±${tol}kg`,
    };
  }

  // ── Pure agreement ladder on distinct contributor count. ──
  if (corroboratingCount >= AUTO_CONFIRM_THRESHOLD) {
    return {
      status: 'CONFIRMED',
      confidence: 'HIGH',
      corroboratingCount,
      value: newContribution.value,
      source,
      requiresHumanReview: false,
      reason: `${corroboratingCount} distinct owners agree (≥${AUTO_CONFIRM_THRESHOLD} auto-confirm)`,
    };
  }

  if (corroboratingCount >= FLAG_THRESHOLD) {
    return {
      status: 'ESTIMATE',
      confidence: 'MEDIUM',
      corroboratingCount,
      value: newContribution.value,
      source,
      requiresHumanReview: true,
      reason: `${corroboratingCount} distinct owners agree — flagged for moderator confirmation`,
    };
  }

  // Exactly one distinct contributor.
  return {
    status: 'ESTIMATE',
    confidence: 'LOW',
    corroboratingCount,
    value: newContribution.value,
    source,
    requiresHumanReview: false,
    reason: '1 owner reports this value',
  };
}
