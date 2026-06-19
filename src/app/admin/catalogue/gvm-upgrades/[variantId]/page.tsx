import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import {
  getBaseVariantAction,
  listGvmUpgradesForVariantAction,
} from '@/modules/gvm-upgrade/actions/gvm-upgrade-admin.actions';
import { GvmUpgradeDisclaimerBanner } from '@/modules/gvm-upgrade/components/GvmUpgradeDisclaimerBanner';
import { GvmUpgradesManager } from './_components/GvmUpgradesManager';

export const metadata = { title: 'Manage GVM Upgrades — Admin' };

export default async function ManageGvmUpgradesPage({
  params,
}: {
  params: Promise<{ variantId: string }>;
}) {
  const { variantId } = await params;
  const [base, upgrades] = await Promise.all([
    getBaseVariantAction(variantId),
    listGvmUpgradesForVariantAction(variantId),
  ]);
  if (!base) notFound();

  const factory = {
    gvmKg: base.gvmKg,
    gcmKg: base.gcmKg,
    frontAxleLimitKg: base.frontAxleLimitKg,
    rearAxleLimitKg: base.rearAxleLimitKg,
    maxTowingKg: base.maxTowingCapacityKg,
  };

  return (
    <div>
      <AdminPageHeader
        title={`${base.makeName} ${base.modelName} ${base.variantName}`}
        description={`GVM upgrades for this base variant (${base.yearFrom}–${base.yearTo}). Each kit overlays the factory limits below.`}
        actions={
          <Link
            href="/admin/catalogue/gvm-upgrades"
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
          >
            ← All vehicles
          </Link>
        }
      />

      <GvmUpgradeDisclaimerBanner />

      <div className="mt-6">
        <GvmUpgradesManager
          variantId={variantId}
          factory={factory}
          initialUpgrades={upgrades}
        />
      </div>
    </div>
  );
}
