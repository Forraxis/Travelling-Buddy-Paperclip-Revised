import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getCategoryByIdAction,
  listCategoriesAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import { CategoryForm } from "../CategoryForm";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const [category, allResult] = await Promise.all([
    getCategoryByIdAction(categoryId),
    listCategoriesAction(undefined, undefined),
  ]);
  if (!category) notFound();

  const parentOptions = allResult.items
    .filter((c) => c.id !== categoryId)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <AdminPageHeader
        title={category.name}
        description="Edit category details."
      />
      <CategoryForm
        category={category}
        parentOptions={parentOptions}
        backHref="/admin/catalogue/categories"
      />
    </div>
  );
}
