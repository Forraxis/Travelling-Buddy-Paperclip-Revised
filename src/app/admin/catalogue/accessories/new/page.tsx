import { AdminPageHeader } from '@/modules/admin/components';
import {
  listBrandsAction,
  listCategoriesAction,
} from '@/modules/catalogue/actions/accessory-admin.actions';
import { AccessoryForm } from '../AccessoryForm';

export default async function NewAccessoryPage() {
  const [brandsResult, categoriesResult] = await Promise.all([
    listBrandsAction(undefined, undefined),
    listCategoriesAction(undefined, undefined),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="New Accessory"
        description="Add a new accessory to the catalogue."
      />
      <AccessoryForm
        brands={brandsResult.items}
        categories={categoriesResult.items}
        backHref="/admin/catalogue/accessories"
      />
    </div>
  );
}
