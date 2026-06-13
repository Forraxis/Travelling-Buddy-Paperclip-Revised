import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import { auth } from '@/lib/auth';
import { getTrustTierConfigAction } from '@/modules/admin/actions/trust-tier-config.actions';
import { TrustTierConfigForm } from './_components/TrustTierConfigForm';

export const metadata = { title: 'Trust Tier Thresholds — Admin' };

export default async function TrustTierSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin');
  }

  const config = await getTrustTierConfigAction();

  return (
    <div>
      <AdminPageHeader
        title="Trust Tier Thresholds"
        description="Configure the submission counts and account age thresholds used to promote users through trust tiers. Changes take effect within 60 seconds."
      />
      <TrustTierConfigForm initial={config} />
    </div>
  );
}
