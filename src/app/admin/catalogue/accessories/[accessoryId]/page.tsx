import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getAccessoryByIdAction,
  listBrandsAction,
  listCategoriesAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import { AccessoryForm } from "../AccessoryForm";

export default async function AccessoryDetailPage({
  params,
}: {
  params: Promise<{ accessoryId: string }>;
}) {
  const { accessoryId } = await params;
  const [accessory, brandsResult, categoriesResult] = await Promise.all([
    getAccessoryByIdAction(accessoryId),
    listBrandsAction(undefined, undefined),
    listCategoriesAction(undefined, undefined),
  ]);
  if (!accessory) notFound();

  return (
    <div>
      <AdminPageHeader
        title={accessory.name}
        description="Edit accessory details."
        actions={
          <Link
            href={`/admin/catalogue/accessories/${accessoryId}/fitments`}
            className="rounded-lg border border-tb-neutral-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            Manage Fitments
          </Link>
        }
      />
      <AccessoryForm
        accessory={accessory}
        brands={brandsResult.items}
        categories={categoriesResult.items}
        backHref="/admin/catalogue/accessories"
      />
    </div>
  );
}
