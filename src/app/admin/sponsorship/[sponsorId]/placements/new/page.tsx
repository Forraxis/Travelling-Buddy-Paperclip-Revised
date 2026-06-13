import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import {
  getSponsorByIdAction,
  listCategoryOptionsAction,
  listAccessoryOptionsAction,
} from '@/modules/sponsorship/actions/sponsor-admin.actions';
import { PlacementForm } from './_components/PlacementForm';

export default async function NewPlacementPage({
  params,
}: {
  params: Promise<{ sponsorId: string }>;
}) {
  const { sponsorId } = await params;
  const [sponsor, categories, accessories] = await Promise.all([
    getSponsorByIdAction(sponsorId),
    listCategoryOptionsAction(),
    listAccessoryOptionsAction(),
  ]);
  if (!sponsor) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Add Placement"
        description={`Create a new sponsored placement for ${sponsor.name}.`}
      />
      <PlacementForm
        sponsorId={sponsorId}
        sponsorName={sponsor.name}
        categories={categories}
        accessories={accessories}
        backHref={`/admin/sponsorship/${sponsorId}`}
      />
    </div>
  );
}
