import { AdminPageHeader } from '@/modules/admin/components';
import { listSponsorsAction } from '@/modules/sponsorship/actions/sponsor-admin.actions';
import { SponsorsList } from './_components/SponsorsList';
import Link from 'next/link';

export const metadata = { title: 'Sponsors — Admin' };

export default async function SponsorshipPage() {
  const sponsors = await listSponsorsAction();

  return (
    <div>
      <AdminPageHeader
        title="Sponsors"
        description="Manage sponsors and their placement history."
        actions={
          <Link
            href="/admin/sponsorship/new"
            className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            + New Sponsor
          </Link>
        }
      />
      <SponsorsList initialSponsors={sponsors} />
    </div>
  );
}
