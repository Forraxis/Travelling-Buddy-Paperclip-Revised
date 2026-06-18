'use server';

/**
 * Admin server actions for the vehicle-spec fetch pipeline (Phases 3–5).
 *
 * Lifecycle: fetch (MOCK) → candidate row + per-field provenance → admin reviews
 * /edits/corroborates → promote (gated) → CATALOGUE VehicleVariant. Mirrors the
 * moderation approve path's transaction shape (ModerationAction + AuditLog).
 *
 * SAFETY: only the MOCK provider runs synchronously here. QWEN/CLAUDE are coded
 * (provider layer + BullMQ job) but NOT surfaced in the UI and gated behind
 * SPEC_FETCH_LIVE_ENABLED, so no live model call can persist data tonight.
 */
import { revalidatePath } from 'next/cache';
import type { Prisma, SubmissionStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';
import {
  getSpecFetchProvider,
  isComplianceCriticalField,
  type SpecFetchInput,
  type SpecFetchProviderId,
} from '@/lib/spec-fetch';
import {
  promoteSpecCandidate,
  PromotionGateError,
} from '@/lib/spec-fetch/promote-candidate';

const BASE_PATH = '/admin/catalogue/vehicles/spec-fetch';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ── Fetch ─────────────────────────────────────────────────────────────────

export async function fetchCandidate(
  input: SpecFetchInput,
  providerId: SpecFetchProviderId = 'MOCK',
): Promise<ActionResult<{ candidateId: string }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!input.makeName?.trim() || !input.modelName?.trim() || !input.yearFrom) {
    return { success: false, error: 'Make, model and year are required.' };
  }

  // Tonight: only MOCK is wired. QWEN/CLAUDE go through the (guarded) job path.
  if (providerId !== 'MOCK') {
    return {
      success: false,
      error:
        'Only the MOCK provider is enabled. Live QWEN/CLAUDE fetches are gated ' +
        'behind SPEC_FETCH_LIVE_ENABLED and run as a background job (see TODO).',
    };
  }

  try {
    const provider = getSpecFetchProvider(providerId);
    const result = await provider.fetchVehicleSpec(input);

    const candidate = await prisma.vehicleSpecCandidate.create({
      data: {
        makeName: input.makeName.trim(),
        modelName: input.modelName.trim(),
        variantName: input.variantName?.trim() || null,
        yearFrom: input.yearFrom,
        yearTo: input.yearTo ?? null,
        bodyType: input.bodyType ?? null,
        market: input.market ?? 'AU',
        provider: result.provider,
        providerModel: result.providerModel,
        promptVersion: result.promptVersion,
        rawResponse: toJson(result.raw),
        status: 'PENDING',
        createdById: user.id,
        fields: {
          create: result.fields.map((f) => ({
            field: f.field,
            value: f.value,
            confidence: f.confidence,
            sourceUrl: f.sourceUrl,
            provider: result.provider,
            isComplianceCritical: isComplianceCriticalField(f.field),
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath(BASE_PATH);
    return { success: true, data: { candidateId: candidate.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Fetch failed',
    };
  }
}

// ── Field edits ──────────────────────────────────────────────────────────

export async function updateCandidateField(
  fieldId: string,
  patch: {
    adminValue?: string | null;
    corroborated?: boolean;
    notes?: string | null;
  },
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const field = await prisma.vehicleSpecCandidateField.update({
      where: { id: fieldId },
      data: {
        adminValue:
          patch.adminValue === undefined ? undefined : patch.adminValue || null,
        corroborated: patch.corroborated,
        notes: patch.notes === undefined ? undefined : patch.notes || null,
      },
      select: { candidateId: true },
    });
    revalidatePath(`${BASE_PATH}/${field.candidateId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Update failed',
    };
  }
}

// ── Gating override ────────────────────────────────────────────────────────

export async function setCriticalOverride(
  candidateId: string,
  note: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  if (!note.trim()) {
    return { success: false, error: 'An override reason is required.' };
  }
  try {
    await prisma.vehicleSpecCandidate.update({
      where: { id: candidateId },
      data: {
        criticalOverrideById: user.id,
        criticalOverrideAt: new Date(),
        criticalOverrideNote: note.trim(),
      },
    });
    await prisma.auditLog.create({
      data: {
        entityType: 'VehicleSpecCandidate',
        entityId: candidateId,
        action: 'UPDATE',
        changedBy: user.id,
        changes: toJson({ criticalOverride: { set: true, note: note.trim() } }),
        reason: 'Admin override of compliance-critical gate',
      },
    });
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Override failed',
    };
  }
}

export async function clearCriticalOverride(
  candidateId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await prisma.vehicleSpecCandidate.update({
      where: { id: candidateId },
      data: {
        criticalOverrideById: null,
        criticalOverrideAt: null,
        criticalOverrideNote: null,
      },
    });
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Clear failed',
    };
  }
}

// ── Promote ────────────────────────────────────────────────────────────────

export async function promoteCandidate(
  candidateId: string,
): Promise<ActionResult<{ variantId: string }>> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const candidate = await prisma.vehicleSpecCandidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { status: true },
    });
    if (candidate.status === 'APPROVED') {
      return { success: false, error: 'Candidate already promoted.' };
    }

    // Shared promotion core (gate + transaction + audit), reused by the ROVER
    // runner. PromotionGateError carries the human-readable blocking message.
    const { variantId } = await promoteSpecCandidate(candidateId, user.id);

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: { variantId } };
  } catch (e) {
    if (e instanceof PromotionGateError) {
      return { success: false, error: e.message };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Promotion failed',
    };
  }
}

// ── Reject ─────────────────────────────────────────────────────────────────

export async function rejectCandidate(
  candidateId: string,
  notes?: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicleSpecCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'REJECTED',
          decidedById: user.id,
          decidedAt: new Date(),
          decisionNotes: notes?.trim() || null,
        },
      });
      await tx.moderationAction.create({
        data: {
          submissionType: 'vehicle_spec_candidate',
          submissionId: candidateId,
          moderatorId: user.id,
          action: 'REJECT',
          notes: notes?.trim() || null,
        },
      });
    });
    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Reject failed',
    };
  }
}

// ── Unpublish (reverse a promotion) ──────────────────────────────────────────

/**
 * Reverse a promotion: pull the resulting variant back out of the public
 * CATALOGUE by flipping it to COMMUNITY (with no submitter → invisible to the
 * public once the visibility fix lands), and return the candidate to PENDING.
 * We do NOT delete the variant (it may already be referenced by a Setup); the
 * moat's unpublish has the same "leave the underlying rows, revoke publication"
 * shape. Audited.
 */
export async function unpublishCandidate(
  candidateId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const candidate = await prisma.vehicleSpecCandidate.findUniqueOrThrow({
      where: { id: candidateId },
      select: { resultingVariantId: true, status: true },
    });
    if (!candidate.resultingVariantId) {
      return { success: false, error: 'Candidate has no promoted variant.' };
    }
    await prisma.$transaction(async (tx) => {
      await tx.vehicleVariant.update({
        where: { id: candidate.resultingVariantId! },
        data: { status: 'COMMUNITY', communitySubmitterId: null },
      });
      await tx.vehicleSpecCandidate.update({
        where: { id: candidateId },
        data: { status: 'PENDING', resultingVariantId: null },
      });
      await tx.moderationAction.create({
        data: {
          submissionType: 'vehicle_spec_candidate',
          submissionId: candidateId,
          moderatorId: user.id,
          action: 'REJECT',
          notes: 'Unpublished promoted variant (returned to COMMUNITY)',
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'VehicleSpecCandidate',
          entityId: candidateId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: toJson({
            unpublishedVariantId: candidate.resultingVariantId,
          }),
          reason: 'Spec candidate promotion unpublished',
        },
      });
    });
    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unpublish failed',
    };
  }
}

// ── Reads (for pages) ────────────────────────────────────────────────────────

export async function listCandidates(statusFilter?: SubmissionStatus) {
  return prisma.vehicleSpecCandidate.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { fields: true } },
      createdBy: { select: { name: true, email: true } },
    },
    take: 200,
  });
}

export async function getCandidate(id: string) {
  return prisma.vehicleSpecCandidate.findUnique({
    where: { id },
    include: {
      fields: { orderBy: [{ isComplianceCritical: 'desc' }, { field: 'asc' }] },
      createdBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } },
      criticalOverrideBy: { select: { name: true, email: true } },
      resultingVariant: { select: { id: true, name: true, slug: true } },
    },
  });
}
