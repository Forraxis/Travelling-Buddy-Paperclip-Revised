'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import { inputClassName } from '@/modules/admin/components/FormField';
import {
  createCaravanMakeAction,
  updateCaravanMakeAction,
  deleteCaravanMakeAction,
  listCaravanMakesAction,
} from '@/modules/catalogue/actions/caravan.actions';
import type {
  CaravanMakeDto,
  PaginatedResult,
} from '@/modules/catalogue/types/caravan.types';

export function CaravanMakesList({
  initialData,
  initialSearch,
}: {
  initialData: PaginatedResult<CaravanMakeDto>;
  initialSearch: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(initialSearch);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCountry, setCreateCountry] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CaravanMakeDto | null>(null);

  function handleSearch(q: string) {
    setSearch(q);
    startTransition(async () => {
      const result = await listCaravanMakesAction(undefined, q || undefined);
      setData(result);
    });
  }

  function handleLoadMore() {
    if (!data.nextCursor) return;
    startTransition(async () => {
      const more = await listCaravanMakesAction(
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

  async function handleCreate() {
    if (!createName.trim()) return;
    const result = await createCaravanMakeAction({
      name: createName.trim(),
      countryOfOrigin: createCountry.trim() || null,
    });
    if (result.success) {
      toast('Make created successfully');
      setShowCreate(false);
      setCreateName('');
      setCreateCountry('');
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  async function handleInlineEdit(id: string) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const result = await updateCaravanMakeAction(id, { name: editName.trim() });
    if (result.success) {
      toast('Make updated');
      setEditingId(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCaravanMakeAction(deleteTarget.id);
    if (result.success) {
      toast('Make deleted');
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search makes..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
        <button
          onClick={() => setShowCreate(true)}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          + Add Make
        </button>
      </div>

      {showCreate && (
        <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">New Make</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Name (e.g. Jayco)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className={`${inputClassName} max-w-xs`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <input
              type="text"
              placeholder="Country of origin"
              value={createCountry}
              onChange={(e) => setCreateCountry(e.target.value)}
              className={`${inputClassName} max-w-xs`}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setCreateName('');
                setCreateCountry('');
              }}
              className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 font-medium text-gray-700">Country</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? 'No makes match your search.'
                    : "No caravan makes yet. Click '+ Add Make' to get started."}
                </td>
              </tr>
            ) : (
              data.items.map((make) => (
                <tr
                  key={make.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3">
                    {editingId === make.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleInlineEdit(make.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineEdit(make.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className={`${inputClassName} max-w-[12rem]`}
                        autoFocus
                      />
                    ) : (
                      <Link
                        href={`/admin/catalogue/caravans/${make.slug}`}
                        className="text-tb-primary font-medium hover:underline"
                      >
                        {make.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{make.slug}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {make.countryOfOrigin ?? '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingId(make.id);
                          setEditName(make.name);
                        }}
                        className="hover:text-tb-primary text-sm text-gray-500"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(make)}
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
        title="Delete Make"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all associated models and variants.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
