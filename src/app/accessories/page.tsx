import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { createCategoryService } from "@/modules/catalogue/services/category.service";
import { Breadcrumbs } from "@/components/catalogue/Breadcrumbs";
import type { AccessoryCategoryTree } from "@/modules/catalogue/types/accessory-category.types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accessories",
  description: "Browse accessories for your vehicle or caravan.",
};

const categoryService = createCategoryService(prisma);

function CategoryCard({ category }: { category: AccessoryCategoryTree }) {
  return (
    <Link
      href={`/accessories/${category.slug}`}
      className="group flex flex-col gap-1 rounded-xl border border-tb-neutral-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <span className="text-base font-semibold text-tb-primary group-hover:text-tb-primary-light">
        {category.name}
      </span>
      {category.description && (
        <span className="text-sm text-gray-500 line-clamp-2">{category.description}</span>
      )}
      {category.children.length > 0 && (
        <span className="mt-1 text-xs text-gray-400">
          {category.children.length} subcategories
        </span>
      )}
    </Link>
  );
}

export default async function AccessoriesPage() {
  const tree = await categoryService.listHierarchy();

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[{ label: "Accessories" }]} />

      <div>
        <h1 className="text-2xl font-bold text-tb-primary">Accessories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse accessories by category for your vehicle or caravan.
        </p>
      </div>

      {tree.length === 0 ? (
        <div className="rounded-xl border border-tb-neutral-200 py-16 text-center text-gray-400">
          No accessory categories yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {tree.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
