/**
 * Ingest a parsed RVD (+ its paired Approval Notice) into the catalogue pipeline:
 *  1. archive both documents (source of truth, idempotent/versioned by hash);
 *  2. create ONE VehicleSpecCandidate per variant — figures auto-corroborated, with
 *     the Approval Notice supplying the fine category + authoritative dates the RVD
 *     lacks. GCM/axle are left for the plate path (not published per variant).
 *
 * Per-variant + idempotent: dedupe by (VTA, variant name) on PENDING candidates, so a
 * re-import refreshes in place rather than duplicating. Lands every candidate as
 * PENDING — the auto-promote-with-audit gate level is still Tim-pending
 * (VEHICLE_DATA_FETCH.md decision 5 / §3 gate-level).
 */
import { prisma } from '@/lib/db';
import { isComplianceCriticalField } from '../fields';
import type { RvdDocument } from './rvd-parser';
import type { ApprovalNotice } from './approval-notice-parser';
import { roverVariantFields } from './variant-fields';
import { storeApprovalNotice, storeRvdDocument } from './archive';

export interface IngestRvdResult {
  vtaNumber: string;
  archivedRvdId: string;
  archivedNoticeId: string | null;
  variantsCreated: number;
  variantsRefreshed: number;
  candidateIds: string[];
}

function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export async function ingestRvd(
  rvd: RvdDocument,
  notice?: ApprovalNotice | null,
  fileNames?: { rvd?: string; notice?: string },
): Promise<IngestRvdResult> {
  if (!rvd.vtaNumber) throw new Error('RVD has no VTA number — cannot ingest.');
  const vtaNumber = rvd.vtaNumber;

  const archivedRvd = await storeRvdDocument(rvd, fileNames?.rvd);
  const archivedNotice = notice
    ? await storeApprovalNotice(notice, fileNames?.notice)
    : null;

  // Year window: prefer the Approval Notice's approval/expiry (authoritative), else
  // fall back to the RVD generation year. (Approval window ≈ availability, not strictly
  // model year — the VTA↔model-year mapping is a known open item.)
  const yearFrom =
    yearOf(notice?.validFrom) ?? yearOf(rvd.generatedDate) ?? null;
  const yearTo = yearOf(notice?.expiresOn);
  const categoryFine = notice?.categoryFine ?? null;

  let variantsCreated = 0;
  let variantsRefreshed = 0;
  const candidateIds: string[] = [];

  for (const variant of rvd.variants) {
    const fields = roverVariantFields(variant);
    const fieldCreate = fields.map((f) => ({
      field: f.field,
      value: f.value,
      confidence: null,
      sourceUrl: null,
      provider: 'ROVER' as const,
      isComplianceCritical: isComplianceCriticalField(f.field),
      corroborated: f.corroborated,
      notes: `ROVER RVD ${vtaNumber} — variant "${variant.name}"${
        categoryFine ? ` (${categoryFine})` : ''
      }`,
    }));

    const candidateData = {
      makeName: rvd.make ?? 'Unknown',
      modelName: rvd.model ?? 'Unknown',
      variantName: variant.name,
      yearFrom: yearFrom ?? 0,
      yearTo,
      provider: 'ROVER' as const,
      providerModel: 'rvd-parser',
      sourceVtaNumber: vtaNumber,
      sourceReportUrl: null,
      rawResponse: JSON.parse(JSON.stringify({ variant, categoryFine })),
      fetchError: null,
    };

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleSpecCandidate.findFirst({
        where: {
          sourceVtaNumber: vtaNumber,
          variantName: variant.name,
          status: 'PENDING',
        },
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
        return { id: existing.id, created: false };
      }
      const created = await tx.vehicleSpecCandidate.create({
        data: {
          ...candidateData,
          status: 'PENDING',
          fields: { create: fieldCreate },
        },
        select: { id: true },
      });
      return { id: created.id, created: true };
    });

    candidateIds.push(result.id);
    if (result.created) variantsCreated += 1;
    else variantsRefreshed += 1;
  }

  return {
    vtaNumber,
    archivedRvdId: archivedRvd.id,
    archivedNoticeId: archivedNotice?.id ?? null,
    variantsCreated,
    variantsRefreshed,
    candidateIds,
  };
}
