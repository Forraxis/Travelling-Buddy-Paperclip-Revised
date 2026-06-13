'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import { inputClassName } from '@/modules/admin/components/FormField';
import {
  listBrandsAction,
  deleteBrandAction,
} from '@/modules/catalogue/actions/accessory-admin.actions';
import type {
  AccessoryBrandDto,
  PaginatedResult,
} from '@/modules/catalogue/types/accessory-brand.types';

export function BrandsList({
  initialData,
  initialSearch,
}: {
  initialData: PaginatedResult<AccessoryBrandDto>;
  initialSearch: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(initialSearch);
  const [deleteTarget, setDeleteTarget] = useState<AccessoryBrandDto | null>(
    null,
  );

  function handleSearch(q: string) {
    setSearch(q);
    startTransition(async () => {
      const result = await listBrandsAction(undefined, q || undefined);
      setData(result);
    });
  }

  function handleLoadMore() {
    if (!data.nextCursor) return;
    startTransition(async () => {
      const more = await listBrandsAction(
        data.nextCursor!,
        search || undefined,
      );
      setData({
        items: [...data.items, ...more.items],
        nextCursor: more.nextCursor,
        hasMore: more.hasMore,
      });
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteBrandAction(deleteTarget.id);
    if (result.success) {
      toast('Brand deleted');
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search brands..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
      </div>

      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700">Partner</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? 'No brands match your search.'
                    : "No brands yet. Click '+ Add Brand' to get started."}
                </td>
              </tr>
            ) : (
              data.items.map((brand) => (
                <tr
                  key={brand.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/catalogue/brands/${brand.id}`}
                      className="text-tb-primary font-medium hover:underline"
                    >
                      {brand.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{brand.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        brand.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {brand.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {brand.isPartner ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/catalogue/brands/${brand.id}`}
                        className="hover:text-tb-primary text-sm text-gray-500"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(brand)}
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

      {data.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {isPending ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Brand"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated accessories.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
