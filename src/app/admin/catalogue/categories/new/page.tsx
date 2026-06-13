import { AdminPageHeader } from '@/modules/admin/components';
import { listCategoriesAction } from '@/modules/catalogue/actions/accessory-admin.actions';
import { CategoryForm } from '../CategoryForm';

export default async function NewCategoryPage() {
  const result = await listCategoriesAction(undefined, undefined);
  const parentOptions = result.items.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <AdminPageHeader
        title="New Category"
        description="Add a new accessory category."
      />
      <CategoryForm
        parentOptions={parentOptions}
        backHref="/admin/catalogue/categories"
      />
    </div>
  );
}
