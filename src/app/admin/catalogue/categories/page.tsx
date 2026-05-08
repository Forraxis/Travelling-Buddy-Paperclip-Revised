import { AdminPageHeader } from "@/modules/admin/components";
import { listCategoriesAction } from "@/modules/catalogue/actions/accessory-admin.actions";
import { CategoriesList } from "./CategoriesList";
import Link from "next/link";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const cursor = params.cursor;
  const result = await listCategoriesAction(cursor, search || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Accessory Categories"
        description="Manage the accessory category hierarchy."
        actions={
          <Link
            href="/admin/catalogue/categories/new"
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
          >
            + Add Category
          </Link>
        }
      />
      <CategoriesList initialData={result} initialSearch={search} />
    </div>
  );
}
