import { AdminPageHeader } from '@/modules/admin/components';
import {
  listAccessoriesAction,
  listBrandsAction,
  listCategoriesAction,
} from '@/modules/catalogue/actions/accessory-admin.actions';
import { AccessoriesList } from './AccessoriesList';
import Link from 'next/link';

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cursor?: string;
    brandId?: string;
    categoryId?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.q ?? '';
  const cursor = params.cursor;
  const brandId = params.brandId;
  const categoryId = params.categoryId;

  const [result, brandsResult, categoriesResult] = await Promise.all([
    listAccessoriesAction(cursor, search || undefined, brandId, categoryId),
    listBrandsAction(undefined, undefined),
    listCategoriesAction(undefined, undefined),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Accessories"
        description="Manage the accessory catalogue — browse, filter, and edit accessories."
        actions={
          <Link
            href="/admin/catalogue/accessories/new"
            className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            + Add Accessory
          </Link>
        }
      />
      <AccessoriesList
        initialData={result}
        initialSearch={search}
        initialBrandId={brandId ?? ''}
        initialCategoryId={categoryId ?? ''}
        brands={brandsResult.items}
        categories={categoriesResult.items}
      />
    </div>
  );
}
