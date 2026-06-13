import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import {
  getSponsorByIdAction,
  listPlacementsForSponsorAction,
} from '@/modules/sponsorship/actions/sponsor-admin.actions';
import { SponsorDetail } from './_components/SponsorDetail';

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ sponsorId: string }>;
}) {
  const { sponsorId } = await params;
  const [sponsor, placements] = await Promise.all([
    getSponsorByIdAction(sponsorId),
    listPlacementsForSponsorAction(sponsorId),
  ]);
  if (!sponsor) notFound();

  return (
    <div>
      <AdminPageHeader
        title={sponsor.name}
        description="Edit sponsor details and manage placements."
      />
      <SponsorDetail sponsor={sponsor} placements={placements} />
    </div>
  );
}
