"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { ConfirmDialog } from "@/modules/admin/components/ConfirmDialog";
import { inputClassName, selectClassName } from "@/modules/admin/components/FormField";
import {
  listAccessoriesAction,
  deleteAccessoryAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import type { AccessoryDto, PaginatedResult } from "@/modules/catalogue/types/accessory.types";
import type { AccessoryBrandDto } from "@/modules/catalogue/types/accessory-brand.types";
import type { AccessoryCategoryDto } from "@/modules/catalogue/types/accessory-category.types";

export function AccessoriesList({
  initialData,
  initialSearch,
  initialBrandId,
  initialCategoryId,
  brands,
  categories,
}: {
  initialData: PaginatedResult<AccessoryDto>;
  initialSearch: string;
  initialBrandId: string;
  initialCategoryId: string;
  brands: AccessoryBrandDto[];
  categories: AccessoryCategoryDto[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(initialSearch);
  const [brandId, setBrandId] = useState(initialBrandId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [deleteTarget, setDeleteTarget] = useState<AccessoryDto | null>(null);

  function reload(q: string, bId: string, cId: string, cursor?: string) {
    startTransition(async () => {
      const result = await listAccessoriesAction(
        cursor,
        q || undefined,
        bId || undefined,
        cId || undefined
      );
      if (cursor) {
        setData((prev) => ({
          items: [...prev.items, ...result.items],
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        }));
      } else {
        setData(result);
      }
    });
  }

  function handleSearch(q: string) {
    setSearch(q);
    reload(q, brandId, categoryId);
  }

  function handleBrandFilter(bId: string) {
    setBrandId(bId);
    reload(search, bId, categoryId);
  }

  function handleCategoryFilter(cId: string) {
    setCategoryId(cId);
    reload(search, brandId, cId);
  }

  function handleLoadMore() {
    if (!data.nextCursor) return;
    reload(search, brandId, categoryId, data.nextCursor);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteAccessoryAction(deleteTarget.id);
    if (result.success) {
      toast("Accessory deleted");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search accessories..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
        <select
          value={brandId}
          onChange={(e) => handleBrandFilter(e.target.value)}
          className={`${selectClassName} max-w-[14rem]`}
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(e) => handleCategoryFilter(e.target.value)}
          className={`${selectClassName} max-w-[14rem]`}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-tb-neutral-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-tb-neutral-200 bg-tb-neutral-50">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Brand</th>
              <th className="px-4 py-3 font-medium text-gray-700">Category</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {search || brandId || categoryId
                    ? "No accessories match your filters."
                    : "No accessories yet. Click '+ Add Accessory' to get started."}
                </td>
              </tr>
            ) : (
              data.items.map((acc) => (
                <tr
                  key={acc.id}
                  className="border-b border-tb-neutral-200 last:border-0 hover:bg-tb-neutral-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/catalogue/accessories/${acc.id}`}
                      className="font-medium text-tb-primary hover:underline"
                    >
                      {acc.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {brandMap.get(acc.brandId) ?? acc.brandId}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {categoryMap.get(acc.categoryId) ?? acc.categoryId}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        acc.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : acc.status === "DISCONTINUED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {acc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/catalogue/accessories/${acc.id}/fitments`}
                        className="text-sm text-gray-500 hover:text-tb-primary"
                      >
                        Fitments
                      </Link>
                      <Link
                        href={`/admin/catalogue/accessories/${acc.id}`}
                        className="text-sm text-gray-500 hover:text-tb-primary"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(acc)}
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
        title="Delete Accessory"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All fitments will also be removed.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
