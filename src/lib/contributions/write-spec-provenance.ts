// P3a — the writer that closes the "owner confirms a spec from their plate →
// value becomes CONFIRMED on the catalogue" loop.
//
// Given an APPROVED VehicleSubmission (its VLM extraction + submitter + target
// catalogue variant), it:
//   1. filters the extraction to the six compliance LIMIT fields only —
//      tare/kerb/geometry are DROPPED here so a personal build figure can never
//      masquerade as a shared confirmed spec;
//   2. for each limit field, gathers the prior DISTINCT-contributor votes from
//      sibling submissions on the same variant, runs the confirmation ladder, and
//   3. UPSERTs VariantSpecProvenance accordingly, never clobbering an
//      authoritative ROVER row, and records a moderation-queue flag when the
//      ladder asks for a human.
//
// IDEMPOTENT: re-running for the same submission re-derives the same votes and
// upserts the same row (the submission's own fingerprint dedups against itself).

import { createHash } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  resolveLadder,
  isCatalogueLimitField,
  fieldToleranceKg,
  CATALOGUE_LIMIT_FIELDS,
  type CatalogueLimitField,
  type ContributionVote,
  type NewContribution,
} from './confirmation-ladder';

/** A Prisma client or an interactive-transaction client — the writer needs only these. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Per-contributor identity for a spec contribution (per variant+field). A
 * signed-in owner is one vote — keyed on `submitterId`, so re-submitting the same
 * field can't clear the ladder alone. Falls back to a content hash of the
 * (variant, field, rounded value) for the rare null-submitter row. Mirrors
 * calibrationFingerprint.
 */
export function contributionFingerprint(args: {
  submitterId: string | null | undefined;
  variantId: string;
  field: string;
  value: number;
}): string {
  const identity = args.submitterId
    ? `user:${args.submitterId}`
    : `anon:${Math.round(args.value)}`;
  const key = [args.variantId, args.field, identity].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** Coerce a VLM/extraction field value to a finite number, or null. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) && v.trim() !== '' ? n : null;
  }
  return null;
}

/**
 * Pull the limit-field numeric values out of a stored vlmExtractionResult. Shape:
 * { fields: { <key>: { value, confidence, source } } }. ONLY the six limit fields
 * are returned — everything else (tare/kerb/geometry) is dropped here. This is the
 * guardrail: build-variable fields never reach the catalogue writer.
 */
export function extractLimitFields(
  extraction: unknown,
): Partial<Record<CatalogueLimitField, number>> {
  const out: Partial<Record<CatalogueLimitField, number>> = {};
  if (!extraction || typeof extraction !== 'object') return out;
  const fields = (extraction as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return out;
  for (const key of CATALOGUE_LIMIT_FIELDS) {
    const raw = (fields as Record<string, unknown>)[key];
    if (!raw || typeof raw !== 'object') continue;
    const n = toNumber((raw as { value?: unknown }).value);
    if (n != null && n > 0) out[key] = n;
  }
  return out;
}

export interface SpecProvenanceWriteInput {
  submissionId: string;
  variantId: string;
  submitterId: string | null;
  contributorTier: 'NEW' | 'BASIC' | 'TRUSTED' | 'EXPERT';
  /** The stored VehicleSubmission.vlmExtractionResult JSON. */
  vlmExtractionResult: unknown;
  /** The stored VehicleSubmission.vlmGatekeeperResult JSON. */
  vlmGatekeeperResult: unknown;
  /** A compliance-plate photo was attached → plate contribution. */
  isPlate: boolean;
}

export interface FieldWriteOutcome {
  field: CatalogueLimitField;
  value: number;
  status: string;
  confidence: string;
  corroboratingCount: number;
  requiresHumanReview: boolean;
  /** Skipped because an authoritative ROVER row already owns this field. */
  skippedAuthoritative?: boolean;
}

function gatekeeperAutoApprove(gatekeeper: unknown): boolean {
  if (!gatekeeper || typeof gatekeeper !== 'object') return false;
  const g = gatekeeper as {
    recommendedAction?: unknown;
    plateAuthenticity?: { assessment?: unknown };
  };
  return (
    g.recommendedAction === 'auto_approve' &&
    g.plateAuthenticity?.assessment === 'genuine'
  );
}

/**
 * Gather prior distinct-contributor votes for (variant, field) from sibling
 * APPROVED vehicle submissions on the same variant. Each submission contributes
 * at most one vote (its fingerprint), so this returns one row per prior owner who
 * reported this field. The CURRENT submission is excluded (it's folded in by the
 * ladder).
 */
async function gatherPriorVotes(
  db: Db,
  variantId: string,
  field: CatalogueLimitField,
  excludeSubmissionId: string,
): Promise<ContributionVote[]> {
  const siblings = await db.vehicleSubmission.findMany({
    where: {
      resultingVariantId: variantId,
      status: 'APPROVED',
      id: { not: excludeSubmissionId },
    },
    select: {
      id: true,
      submitterId: true,
      vlmExtractionResult: true,
    },
  });

  const votes: ContributionVote[] = [];
  for (const s of siblings) {
    const limits = extractLimitFields(s.vlmExtractionResult);
    const value = limits[field];
    if (value == null) continue;
    votes.push({
      value,
      fingerprint: contributionFingerprint({
        submitterId: s.submitterId,
        variantId,
        field,
        value,
      }),
    });
  }
  return votes;
}

/**
 * Write/refresh VariantSpecProvenance for the limit fields a submission confirms.
 * Runs inside the caller's transaction (pass `tx`) so the provenance write commits
 * atomically with the variant promotion + audit log.
 *
 * Returns one outcome per limit field present in the extraction.
 */
export async function writeSpecProvenanceForSubmission(
  db: Db,
  input: SpecProvenanceWriteInput,
): Promise<FieldWriteOutcome[]> {
  const limits = extractLimitFields(input.vlmExtractionResult);
  const autoApprove = gatekeeperAutoApprove(input.vlmGatekeeperResult);
  const outcomes: FieldWriteOutcome[] = [];

  for (const field of Object.keys(limits) as CatalogueLimitField[]) {
    if (!isCatalogueLimitField(field)) continue; // belt-and-braces
    const value = limits[field]!;

    // Non-clobber: an authoritative ROVER row is the federal approval doc; a
    // community/plate contribution never overwrites it. (We could still grow its
    // corroboratingCount, but keep it strictly read-only here to be safe.)
    const existing = await db.variantSpecProvenance.findUnique({
      where: { variantId_field: { variantId: input.variantId, field } },
      select: { source: true, status: true },
    });
    if (existing && existing.source === 'ROVER') {
      outcomes.push({
        field,
        value,
        status: existing.status,
        confidence: 'HIGH',
        corroboratingCount: 0,
        requiresHumanReview: false,
        skippedAuthoritative: true,
      });
      continue;
    }

    const priorVotes = await gatherPriorVotes(
      db,
      input.variantId,
      field,
      input.submissionId,
    );

    const newContribution: NewContribution = {
      field,
      value,
      fingerprint: contributionFingerprint({
        submitterId: input.submitterId,
        variantId: input.variantId,
        field,
        value,
      }),
      isPlate: input.isPlate,
      gatekeeperAutoApprove: autoApprove,
      contributorTier: input.contributorTier,
    };

    const res = resolveLadder(newContribution, priorVotes);

    // Never DOWNGRADE an already-CONFIRMED community row back to ESTIMATE on a
    // later single contribution: once the crowd confirms a limit it stays
    // confirmed unless a human disputes it. (A fresh DISPUTED still routes up.)
    const finalStatus =
      existing?.status === 'CONFIRMED' && res.status === 'ESTIMATE'
        ? 'CONFIRMED'
        : res.status;

    const provData = {
      value: String(Math.round(value)),
      source: res.source, // 'PLATE' | 'COMMUNITY'
      status: finalStatus,
      confidence: res.confidence,
      corroboratingCount: res.corroboratingCount,
      asOf: new Date(),
      notes: res.reason,
    };

    await db.variantSpecProvenance.upsert({
      where: { variantId_field: { variantId: input.variantId, field } },
      update: provData,
      create: { variantId: input.variantId, field, ...provData },
    });

    // Flag for human moderation when the ladder asks (2-agree, or any dispute).
    // Uses REQUEST_INFO (the existing "needs a human" action) on a synthetic
    // submissionType so the moderation list can surface it without a schema
    // change. The moderator's normal approve flow then sets status=CONFIRMED.
    // moderatorId must satisfy the User FK — a submission always has a submitter,
    // so skip the queue row in the (impossible) null case rather than break the FK.
    if (res.requiresHumanReview && input.submitterId) {
      await db.moderationAction.create({
        data: {
          submissionType: 'spec_provenance_flag',
          submissionId: `${input.variantId}:${field}`,
          moderatorId: input.submitterId,
          action: 'REQUEST_INFO',
          notes: `${field}=${Math.round(value)}kg (±${fieldToleranceKg(field)}kg): ${res.reason}`,
        },
      });
    }

    outcomes.push({
      field,
      value,
      status: finalStatus,
      confidence: res.confidence,
      corroboratingCount: res.corroboratingCount,
      requiresHumanReview: res.requiresHumanReview,
    });
  }

  return outcomes;
}
