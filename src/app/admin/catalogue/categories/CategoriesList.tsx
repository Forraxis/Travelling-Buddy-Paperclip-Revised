"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { ConfirmDialog } from "@/modules/admin/components/ConfirmDialog";
import { inputClassName } from "@/modules/admin/components/FormField";
import {
  listCategoriesAction,
  deleteCategoryAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import type { AccessoryCategoryDto, PaginatedResult } from "@/modules/catalogue/types/accessory-category.types";

export function CategoriesList({
  initialData,
  initialSearch,
}: {
  initialData: PaginatedResult<AccessoryCategoryDto>;
  initialSearch: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(initialSearch);
  const [deleteTarget, setDeleteTarget] = useState<AccessoryCategoryDto | null>(null);

  function handleSearch(q: string) {
    setSearch(q);
    startTransition(async () => {
      const result = await listCategoriesAction(undefined, q || undefined);
      setData(result);
    });
  }

  function handleLoadMore() {
    if (!data.nextCursor) return;
    startTransition(async () => {
      const more = await listCategoriesAction(data.nextCursor!, search || undefined);
      setData({
        items: [...data.items, ...more.items],
        nextCursor: more.nextCursor,
        hasMore: more.hasMore,
      });
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCategoryAction(deleteTarget.id);
    if (result.success) {
      toast("Category deleted");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-tb-neutral-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-tb-neutral-200 bg-tb-neutral-50">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
              <th className="px-4 py-3 font-medium text-gray-700">Order</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? "No categories match your search."
                    : "No categories yet. Click '+ Add Category' to get started."}
                </td>
              </tr>
            ) : (
              data.items.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-tb-neutral-200 last:border-0 hover:bg-tb-neutral-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/catalogue/categories/${cat.id}`}
                      className="font-medium text-tb-primary hover:underline"
                    >
                      {cat.parentId && (
                        <span className="mr-1 text-gray-400">↳</span>
                      )}
                      {cat.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{cat.slug}</td>
                  <td className="px-4 py-3 text-gray-500">{cat.displayOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/catalogue/categories/${cat.id}`}
                        className="text-sm text-gray-500 hover:text-tb-primary"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(cat)}
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
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Child categories will be unlinked.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
