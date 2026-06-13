import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createCategoryService } from '@/modules/catalogue/services/category.service';
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs';
import { SearchInput } from '@/components/catalogue/SearchInput';
import { PaginationBar } from '@/components/catalogue/PaginationBar';

export const dynamic = 'force-dynamic';

const categoryService = createCategoryService(prisma);

const PAGE_SIZE = 24;

interface Props {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ q?: string; cursor?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: categorySlug } = await params;
  const category = await categoryService.getBySlug(categorySlug);
  if (!category) return { title: 'Category Not Found' };
  return {
    title: category.name,
    description: category.description ?? `Browse ${category.name} accessories.`,
  };
}

interface AccessoryListItem {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  priceMin: number | null;
  currencyCode: string;
  brandSlug: string;
}

function AccessoryCard({ accessory }: { accessory: AccessoryListItem }) {
  return (
    <Link
      href={`/accessories/${accessory.brandSlug}/${accessory.slug}/`}
      className="group border-tb-neutral-200 flex flex-col gap-2 rounded-xl border bg-white p-4 transition-shadow hover:shadow-md"
    >
      {accessory.imageUrls[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={accessory.imageUrls[0]}
          alt={accessory.name}
          className="h-36 w-full rounded-lg object-cover"
        />
      )}
      <span className="text-tb-primary group-hover:text-tb-primary-light text-sm font-semibold">
        {accessory.name}
      </span>
      {accessory.priceMin !== null && (
        <span className="text-xs text-gray-500">
          From {accessory.currencyCode} {accessory.priceMin.toFixed(2)}
        </span>
      )}
    </Link>
  );
}

export default async function CategoryAccessoriesPage({
  params,
  searchParams,
}: Props) {
  const { brand: categorySlug } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const cursor = sp.cursor;

  const category = await categoryService.getBySlug(categorySlug);
  if (!category) notFound();

  let items: AccessoryListItem[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  if (q) {
    const rawItems = await prisma.accessory.findMany({
      where: {
        categoryId: category.id,
        status: 'ACTIVE',
        name: { contains: q, mode: 'insensitive' },
      },
      take: 50,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrls: true,
        priceMin: true,
        currencyCode: true,
        brand: { select: { slug: true } },
      },
    });
    items = rawItems.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrls: r.imageUrls,
      priceMin: r.priceMin
        ? (r.priceMin as unknown as { toNumber(): number }).toNumber()
        : null,
      currencyCode: r.currencyCode,
      brandSlug: r.brand.slug,
    }));
  } else {
    const rawItems = await prisma.accessory.findMany({
      where: { categoryId: category.id, status: 'ACTIVE' },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrls: true,
        priceMin: true,
        currencyCode: true,
        brand: { select: { slug: true } },
      },
    });
    hasMore = rawItems.length > PAGE_SIZE;
    const page = hasMore ? rawItems.slice(0, PAGE_SIZE) : rawItems;
    nextCursor = hasMore ? page[page.length - 1].id : null;
    items = page.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrls: r.imageUrls,
      priceMin: r.priceMin
        ? (r.priceMin as unknown as { toNumber(): number }).toNumber()
        : null,
      currencyCode: r.currencyCode,
      brandSlug: r.brand.slug,
    }));
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: 'Accessories', href: '/accessories' },
          { label: category.name },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-tb-primary text-2xl font-bold">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-1 text-sm text-gray-500">{category.description}</p>
          )}
        </div>
        <div className="w-full sm:max-w-xs">
          <Suspense>
            <SearchInput placeholder={`Search ${category.name}...`} />
          </Suspense>
        </div>
      </div>

      {category.children.length > 0 && !q && (
        <div className="flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/accessories/${child.slug}/`}
              className="border-tb-neutral-200 hover:border-tb-primary-light hover:text-tb-primary rounded-full border bg-white px-3 py-1 text-xs font-medium text-gray-600"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="border-tb-neutral-200 rounded-xl border py-16 text-center text-gray-400">
          {q
            ? `No accessories match "${q}".`
            : `No accessories in ${category.name} yet.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((acc) => (
            <AccessoryCard key={acc.id} accessory={acc} />
          ))}
        </div>
      )}

      {!q && (
        <PaginationBar
          basePath={`/accessories/${categorySlug}`}
          searchParams={sp as Record<string, string | undefined>}
          nextCursor={nextCursor}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}
