import { AdminPageHeader } from "@/modules/admin/components";
import { listBrandsAction } from "@/modules/catalogue/actions/accessory-admin.actions";
import { BrandsList } from "./BrandsList";
import Link from "next/link";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const cursor = params.cursor;
  const result = await listBrandsAction(cursor, search || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Accessory Brands"
        description="Manage accessory brands — manufacturers and their partner status."
        actions={
          <Link
            href="/admin/catalogue/brands/new"
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
          >
            + Add Brand
          </Link>
        }
      />
      <BrandsList initialData={result} initialSearch={search} />
    </div>
  );
}
