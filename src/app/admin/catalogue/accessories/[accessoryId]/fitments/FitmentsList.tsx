'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import { deleteFitmentAction } from '@/modules/catalogue/actions/accessory-admin.actions';
import type { AccessoryFitmentDto } from '@/modules/catalogue/types/fitment.types';

export function FitmentsList({
  fitments,
  accessoryId,
}: {
  fitments: AccessoryFitmentDto[];
  accessoryId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<AccessoryFitmentDto | null>(
    null,
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteFitmentAction(deleteTarget.id, accessoryId);
    if (result.success) {
      toast('Fitment deleted');
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  return (
    <div>
      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Target</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Mounting Location
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Weight (kg)
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Confidence
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {fitments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No fitments yet. Click &apos;+ Add Fitment&apos; to get
                  started.
                </td>
              </tr>
            ) : (
              fitments.map((f) => (
                <tr
                  key={f.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3 text-gray-600">
                    {f.vehicleVariantId
                      ? `Vehicle: ${f.vehicleVariantId}`
                      : f.caravanVariantId
                        ? `Caravan: ${f.caravanVariantId}`
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {f.mountingLocation.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {f.installedWeightKg}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        f.confidence === 'VERIFIED'
                          ? 'bg-green-100 text-green-700'
                          : f.confidence === 'MANUFACTURER_SPEC'
                            ? 'bg-blue-100 text-blue-700'
                            : f.confidence === 'COMMUNITY'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {f.confidence.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/catalogue/accessories/${accessoryId}/fitments/${f.id}`}
                        className="hover:text-tb-primary text-sm text-gray-500"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(f)}
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
        title="Delete Fitment"
        message="Are you sure you want to delete this fitment? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
