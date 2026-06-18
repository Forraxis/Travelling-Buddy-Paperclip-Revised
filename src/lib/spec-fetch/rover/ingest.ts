/**
 * Persist a ROVER candidate draft → a VehicleSpecCandidate (provider = ROVER).
 *
 * The candidate-creation wiring for the structured-parse path. Two things make it
 * distinct from the LLM fetch path:
 *  1. Fields land with `corroborated: true` (present values) — the structured-parse
 *     auto-corroboration that lets a ROVER candidate clear the compliance gate
 *     without an admin tick (the figure came from the government document).
 *  2. Idempotent by VTA — the incremental crawl re-runs freely; an existing PENDING
 *     candidate for the same VTA is refreshed in place, never duplicated.
 *
 * It still lands as PENDING (the human-in-the-loop promote step is unchanged). The
 * "auto-promote with audit" gate level for structured ROVER imports is a separate,
 * Tim-pending decision (VEHICLE_DATA_FETCH.md §3 "Gate-level") — wire it on top of
 * this once confirmed; this module deliberately does not promote on its own.
 */
import { prisma } from '@/lib/db';
import type { RoverCandidateDraft } from './verifier';

export interface IngestRoverResult {
  candidateId: string;
  /** True when an existing PENDING candidate for this VTA was refreshed, not created. */
  refreshed: boolean;
  fieldCount: number;
}

/**
 * Upsert a candidate for the draft's VTA. If a PENDING candidate already exists for
 * this `sourceVtaNumber` we replace its fields and provenance in place; otherwise we
 * create a fresh one. Already-decided candidates (APPROVED/REJECTED) are left
 * untouched and a new PENDING one is created, so a re-import after a correction is
 * reviewable rather than silently mutating a promoted record.
 */
export async function createRoverCandidate(
  draft: RoverCandidateDraft,
): Promise<IngestRoverResult> {
  const { ref } = draft;

  const fieldCreate = draft.fields.map((f) => ({
    field: f.field,
    value: f.value,
    confidence: null,
    sourceUrl: f.sourceUrl,
    provider: 'ROVER' as const,
    isComplianceCritical: f.isComplianceCritical,
    corroborated: f.corroborated,
    notes: `ROVER consumer report — "${f.sourceLabel}"`,
  }));

  const candidateData = {
    makeName: ref.makeName,
    modelName: ref.modelName,
    variantName: ref.variantName ?? null,
    yearFrom: ref.yearFrom,
    yearTo: ref.yearTo ?? null,
    bodyType: ref.bodyType ?? null,
    provider: 'ROVER' as const,
    providerModel: draft.parserId,
    sourceVtaNumber: ref.vtaNumber,
    sourceReportUrl: ref.reportUrl,
    rawResponse: JSON.parse(JSON.stringify(draft.raw)),
    fetchError: null,
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.vehicleSpecCandidate.findFirst({
      where: { sourceVtaNumber: ref.vtaNumber, status: 'PENDING' },
      select: { id: true },
    });

    if (existing) {
      await tx.vehicleSpecCandidateField.deleteMany({
        where: { candidateId: existing.id },
      });
      await tx.vehicleSpecCandidate.update({
        where: { id: existing.id },
        data: { ...candidateData, fields: { create: fieldCreate } },
      });
      return {
        candidateId: existing.id,
        refreshed: true,
        fieldCount: fieldCreate.length,
      };
    }

    const created = await tx.vehicleSpecCandidate.create({
      data: {
        ...candidateData,
        status: 'PENDING',
        fields: { create: fieldCreate },
      },
      select: { id: true },
    });
    return {
      candidateId: created.id,
      refreshed: false,
      fieldCount: fieldCreate.length,
    };
  });
}
