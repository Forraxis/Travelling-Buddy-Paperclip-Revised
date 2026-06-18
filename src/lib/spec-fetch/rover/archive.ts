/**
 * Persist parsed ROVER documents into the RoverDocument source-of-truth archive.
 * Idempotent + versioned by contentHash: identical content re-imports to the same
 * row (no-op update of metadata); an amended approval (new hash) creates a new row,
 * so every version of a VTA is retained and re-mineable.
 *
 * Stores the full structured parse (minus the bulky rawText, which is its own
 * column) so future projects can derive fields we don't use today.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { RvdDocument } from './rvd-parser';
import type { ApprovalNotice } from './approval-notice-parser';

export interface ArchiveResult {
  id: string;
  created: boolean;
}

/** Strip rawText from the structured blob (it lives in its own column). */
function parsedJson(doc: Record<string, unknown>): Prisma.InputJsonValue {
  const copy = { ...doc };
  delete copy.rawText;
  return JSON.parse(JSON.stringify(copy)) as Prisma.InputJsonValue;
}

export async function storeRvdDocument(
  rvd: RvdDocument,
  fileName?: string,
): Promise<ArchiveResult> {
  if (!rvd.vtaNumber) {
    throw new Error('Cannot archive an RVD with no VTA number.');
  }
  const where = {
    vtaNumber_docType_contentHash: {
      vtaNumber: rvd.vtaNumber,
      docType: 'RVD' as const,
      contentHash: rvd.contentHash,
    },
  };
  const existing = await prisma.roverDocument.findUnique({
    where,
    select: { id: true },
  });
  const data = {
    fileName: fileName ?? null,
    make: rvd.make,
    model: rvd.model,
    categoryBroad: rvd.categoryBroad,
    categoryFine: null,
    generatedDate: rvd.generatedDate,
    rawText: rvd.rawText,
    parsed: parsedJson(rvd as unknown as Record<string, unknown>),
    variantCount: rvd.variants.length,
  };
  const row = await prisma.roverDocument.upsert({
    where,
    create: {
      vtaNumber: rvd.vtaNumber,
      docType: 'RVD',
      contentHash: rvd.contentHash,
      ...data,
    },
    update: data,
    select: { id: true },
  });
  return { id: row.id, created: !existing };
}

export async function storeApprovalNotice(
  notice: ApprovalNotice,
  fileName?: string,
): Promise<ArchiveResult> {
  if (!notice.vtaNumber) {
    throw new Error('Cannot archive an Approval Notice with no VTA number.');
  }
  const where = {
    vtaNumber_docType_contentHash: {
      vtaNumber: notice.vtaNumber,
      docType: 'APPROVAL_NOTICE' as const,
      contentHash: notice.contentHash,
    },
  };
  const existing = await prisma.roverDocument.findUnique({
    where,
    select: { id: true },
  });
  const data = {
    fileName: fileName ?? null,
    make: null,
    model: notice.vehicleType,
    categoryBroad: null,
    categoryFine: notice.categoryFine,
    validFrom: notice.validFrom,
    variationValidFrom: notice.variationValidFrom,
    expiresOn: notice.expiresOn,
    rawText: notice.rawText,
    parsed: parsedJson(notice as unknown as Record<string, unknown>),
    variantCount: notice.variants.length,
  };
  const row = await prisma.roverDocument.upsert({
    where,
    create: {
      vtaNumber: notice.vtaNumber,
      docType: 'APPROVAL_NOTICE',
      contentHash: notice.contentHash,
      ...data,
    },
    update: data,
    select: { id: true },
  });
  return { id: row.id, created: !existing };
}
