'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import { deleteCaravanVariantAction } from '@/modules/catalogue/actions/caravan.actions';
import type {
  CaravanModelWithVariants,
  CaravanVariantDto,
  CaravanMakeDto,
} from '@/modules/catalogue/types/caravan.types';

const AXLE_LABELS: Record<string, string> = {
  SINGLE_AXLE: 'Single',
  DUAL_AXLE_CLOSE_COUPLED: 'Dual (Close)',
  DUAL_AXLE_SPREAD: 'Dual (Spread)',
  TRIPLE_AXLE: 'Triple',
};

export function CaravanVariantsList({
  model,
  makeSlug,
}: {
  model: CaravanModelWithVariants & { make: CaravanMakeDto };
  makeSlug: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<CaravanVariantDto | null>(
    null,
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCaravanVariantAction(deleteTarget.id);
    if (result.success) {
      toast('Variant deleted');
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  function yearRange(v: CaravanVariantDto) {
    if (v.isCurrentProduction) return `${v.yearFrom}\u2013present`;
    return `${v.yearFrom}\u2013${v.yearTo}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Link
          href={`/admin/catalogue/caravans/${makeSlug}/${model.slug}/new`}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          + Add Variant
        </Link>
      </div>

      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Years</th>
              <th className="px-4 py-3 font-medium text-gray-700">Axle</th>
              <th className="px-4 py-3 font-medium text-gray-700">ATM (kg)</th>
              <th className="px-4 py-3 font-medium text-gray-700">Tare (kg)</th>
              <th className="px-4 py-3 font-medium text-gray-700">TBM (kg)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {model.variants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No variants yet. Click &apos;+ Add Variant&apos; to get
                  started.
                </td>
              </tr>
            ) : (
              model.variants.map((variant) => (
                <tr
                  key={variant.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/catalogue/caravans/${makeSlug}/${model.slug}/${variant.slug}`}
                      className="text-tb-primary font-medium hover:underline"
                    >
                      {variant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {yearRange(variant)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {AXLE_LABELS[variant.axleConfiguration] ??
                      variant.axleConfiguration}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {variant.atmKg?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {variant.tareKg?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">
                    {variant.tbmKg?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/catalogue/caravans/${makeSlug}/${model.slug}/${variant.slug}`}
                        className="hover:text-tb-primary text-sm text-gray-500"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(variant)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Variant"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
