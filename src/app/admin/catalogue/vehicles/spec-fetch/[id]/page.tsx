import { notFound, redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { SPEC_FIELD_BY_KEY } from '@/lib/spec-fetch';
import { getCandidate } from '../actions';
import {
  CandidateReview,
  type CandidateView,
  type FieldView,
} from '../_components/CandidateReview';

export const metadata = { title: 'Review Candidate — Admin' };

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const fields: FieldView[] = candidate.fields.map((f) => ({
    id: f.id,
    field: f.field,
    label: SPEC_FIELD_BY_KEY[f.field]?.label ?? f.field,
    unit: SPEC_FIELD_BY_KEY[f.field]?.unit ?? '',
    value: f.value,
    confidence: f.confidence,
    sourceUrl: f.sourceUrl,
    isComplianceCritical: f.isComplianceCritical,
    adminValue: f.adminValue,
    corroborated: f.corroborated,
    notes: f.notes,
  }));

  const view: CandidateView = {
    id: candidate.id,
    makeName: candidate.makeName,
    modelName: candidate.modelName,
    variantName: candidate.variantName,
    yearFrom: candidate.yearFrom,
    yearTo: candidate.yearTo,
    provider: candidate.provider,
    providerModel: candidate.providerModel,
    status: candidate.status,
    hasOverride: candidate.criticalOverrideById !== null,
    overrideNote: candidate.criticalOverrideNote,
    overrideBy:
      candidate.criticalOverrideBy?.name ??
      candidate.criticalOverrideBy?.email ??
      null,
    overrideAt: candidate.criticalOverrideAt?.toISOString() ?? null,
    resultingVariantId: candidate.resultingVariantId,
    resultingVariantName: candidate.resultingVariant?.name ?? null,
    decisionNotes: candidate.decisionNotes,
    fields,
  };

  return (
    <div>
      <AdminPageHeader
        title={`${candidate.makeName} ${candidate.modelName}${
          candidate.variantName ? ` ${candidate.variantName}` : ''
        }`}
        description={`Candidate spec from ${candidate.provider}. Review each field, corroborate or edit compliance-critical values, then promote.`}
      />
      <CandidateReview candidate={view} />
    </div>
  );
}
