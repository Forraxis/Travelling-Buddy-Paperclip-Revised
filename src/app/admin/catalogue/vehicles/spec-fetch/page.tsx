import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { listCandidates } from './actions';
import {
  SpecFetchConsole,
  type CandidateListItem,
} from './_components/SpecFetchConsole';

export const metadata = { title: 'Vehicle Spec Fetch — Admin' };

export default async function SpecFetchPage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const candidates = await listCandidates();
  const items: CandidateListItem[] = candidates.map((c) => ({
    id: c.id,
    makeName: c.makeName,
    modelName: c.modelName,
    variantName: c.variantName,
    yearFrom: c.yearFrom,
    yearTo: c.yearTo,
    provider: c.provider,
    status: c.status,
    fieldCount: c._count.fields,
    hasOverride: c.criticalOverrideById !== null,
    resultingVariantId: c.resultingVariantId,
    createdBy: c.createdBy?.name ?? c.createdBy?.email ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div>
      <AdminPageHeader
        title="Vehicle Spec Fetch"
        description="AI/admin-assisted vehicle-spec ingestion. Fetch candidate specs (mock provider tonight), review per-field provenance, gate compliance-critical fields, then promote to the catalogue. Candidates are never public until promoted."
      />
      <SpecFetchConsole initialItems={items} />
    </div>
  );
}
