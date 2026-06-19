import { AdminPageHeader } from '@/modules/admin/components';
import { listBaseVariantsWithUpgradesAction } from '@/modules/gvm-upgrade/actions/gvm-upgrade-admin.actions';
import { GvmUpgradeDisclaimerBanner } from '@/modules/gvm-upgrade/components/GvmUpgradeDisclaimerBanner';
import { BaseVariantSearch } from './_components/BaseVariantSearch';
import Link from 'next/link';

export const metadata = { title: 'GVM Upgrades — Admin' };

export default async function GvmUpgradesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? '';
  const variants = await listBaseVariantsWithUpgradesAction(
    search || undefined,
  );

  return (
    <div>
      <AdminPageHeader
        title="GVM Upgrades"
        description="Manage certified GVM-upgrade kits attached to base vehicle variants. Each kit overlays the factory limits (advisory — Rule 11)."
      />

      <GvmUpgradeDisclaimerBanner />

      <div className="mt-6">
        <BaseVariantSearch initialSearch={search} />
      </div>

      <div className="border-tb-neutral-200 mt-4 overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-tb-neutral-50 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Years</th>
              <th className="px-4 py-3 text-right">Factory GVM</th>
              <th className="px-4 py-3 text-right">Upgrades</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-tb-neutral-200 divide-y">
            {variants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? 'No catalogue variants match that search.'
                    : 'No variants have GVM upgrades yet. Search for a base vehicle to attach one.'}
                </td>
              </tr>
            )}
            {variants.map((v) => (
              <tr key={v.variantId} className="hover:bg-tb-neutral-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {v.makeName} {v.modelName}{' '}
                  <span className="text-gray-500">{v.variantName}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {v.yearFrom}–{v.yearTo}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {v.gvmKg != null ? `${v.gvmKg} kg` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {v.upgradeCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/catalogue/gvm-upgrades/${v.variantId}`}
                    className="text-tb-primary hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
