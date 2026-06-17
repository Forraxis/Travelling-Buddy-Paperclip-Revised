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
  evaluatePromotionGate,
  type GateableField,
} from '@/lib/spec-fetch/gating';
import { buildVariantPatch } from '@/lib/spec-fetch/promotion';

const BASE_PATH = '/admin/catalogue/vehicles/spec-fetch';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Short random suffix to keep generated slugs unique without Date/Math in pure code. */
function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
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
      include: { fields: true },
    });
    if (candidate.status === 'APPROVED') {
      return { success: false, error: 'Candidate already promoted.' };
    }

    const gateFields: GateableField[] = candidate.fields.map((f) => ({
      field: f.field,
      value: f.value,
      adminValue: f.adminValue,
      corroborated: f.corroborated,
    }));
    const hasOverride = candidate.criticalOverrideById !== null;
    const gate = evaluatePromotionGate(gateFields, hasOverride);
    if (!gate.allowed) {
      return {
        success: false,
        error: `Blocked: uncorroborated compliance-critical field(s): ${gate.blockingFields.join(
          ', ',
        )}. Corroborate them or record an override.`,
      };
    }

    const { patch } = buildVariantPatch(gateFields);

    const variant = await prisma.$transaction(async (tx) => {
      // Resolve / create make.
      const makeSlug = toSlug(candidate.makeName);
      const make = await tx.vehicleMake.upsert({
        where: { slug: makeSlug },
        update: {},
        create: { name: candidate.makeName, slug: makeSlug },
        select: { id: true },
      });

      // Resolve / create model.
      const modelSlug = toSlug(candidate.modelName);
      const model = await tx.vehicleModel.upsert({
        where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
        update: {},
        create: {
          makeId: make.id,
          name: candidate.modelName,
          slug: modelSlug,
          bodyType: candidate.bodyType ?? 'OTHER',
        },
        select: { id: true },
      });

      const variantName =
        candidate.variantName ?? `${candidate.yearFrom} ${candidate.modelName}`;
      const variantSlug = toSlug(
        `${variantName}-${candidate.yearFrom}-${slugSuffix()}`,
      );

      // Admin-reviewed → promote directly to CATALOGUE (same end-state as the
      // moderation approve path, which flips COMMUNITY→CATALOGUE).
      const created = await tx.vehicleVariant.create({
        data: {
          modelId: model.id,
          status: 'CATALOGUE',
          yearFrom: candidate.yearFrom,
          yearTo: candidate.yearTo ?? candidate.yearFrom,
          isCurrentProduction: false,
          name: variantName,
          slug: variantSlug,
          market: candidate.market,
          ...patch,
        },
        select: { id: true },
      });

      await tx.vehicleSpecCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'APPROVED',
          resultingVariantId: created.id,
          decidedById: user.id,
          decidedAt: new Date(),
        },
      });

      await tx.moderationAction.create({
        data: {
          submissionType: 'vehicle_spec_candidate',
          submissionId: candidateId,
          moderatorId: user.id,
          action: 'APPROVE',
          notes: hasOverride
            ? `Promoted with override: ${candidate.criticalOverrideNote ?? ''}`
            : 'Promoted to CATALOGUE',
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'VehicleSpecCandidate',
          entityId: candidateId,
          action: 'UPDATE',
          changedBy: user.id,
          changes: toJson({
            status: { from: candidate.status, to: 'APPROVED' },
            promotedVariantId: created.id,
            patch,
            override: hasOverride,
          }),
          reason: 'Spec candidate promoted to CATALOGUE',
        },
      });

      return created;
    });

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${candidateId}`);
    return { success: true, data: { variantId: variant.id } };
  } catch (e) {
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
