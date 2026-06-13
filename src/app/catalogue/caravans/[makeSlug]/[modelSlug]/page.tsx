import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { createCaravanService } from '@/modules/catalogue/services/caravan.service';
import { VariantCard } from '@/components/catalogue/VariantCard';
import { FilterChips } from '@/components/catalogue/FilterChips';
import { PaginationBar } from '@/components/catalogue/PaginationBar';
import { Breadcrumbs } from '@/components/catalogue/Breadcrumbs';

export const dynamic = 'force-dynamic';

const service = createCaravanService(prisma);

const AXLE_CONFIGS = [
  { label: 'Single axle', value: 'SINGLE_AXLE' },
  { label: 'Dual (close)', value: 'DUAL_AXLE_CLOSE_COUPLED' },
  { label: 'Dual (spread)', value: 'DUAL_AXLE_SPREAD' },
  { label: 'Triple axle', value: 'TRIPLE_AXLE' },
];

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ makeSlug: string; modelSlug: string }>;
  searchParams: Promise<{
    axleConfiguration?: string;
    year?: string;
    cursor?: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { makeSlug, modelSlug } = await params;
  const model = await service.getModelBySlug(makeSlug, modelSlug);
  if (!model) return { title: 'Not Found' };
  return {
    title: `${model.make.name} ${model.name}`,
    description: `Browse ${model.make.name} ${model.name} caravan variants in the TravellingBuddy catalogue.`,
  };
}

export default async function CaravanVariantsPage({
  params,
  searchParams,
}: Props) {
  const { makeSlug, modelSlug } = await params;
  const sp = await searchParams;
  const axleConfiguration = sp.axleConfiguration;
  const year = sp.year ? parseInt(sp.year, 10) : undefined;
  const cursor = sp.cursor;

  const model = await service.getModelBySlug(makeSlug, modelSlug);
  if (!model) notFound();

  let variants;
  let nextCursor: string | null = null;
  let hasMore = false;

  if (axleConfiguration || year !== undefined) {
    const result = await service.listVariantsFiltered(
      {
        ...(axleConfiguration
          ? {
              axleConfiguration: axleConfiguration as Parameters<
                typeof service.listVariantsFiltered
              >[0]['axleConfiguration'],
            }
          : {}),
        ...(year !== undefined ? { year } : {}),
      },
      { limit: PAGE_SIZE, cursor },
    );
    variants = result.items.filter((v) => v.modelId === model.id);
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  } else {
    const result = await service.listVariantsByModel(model.id, {
      cursor,
      limit: PAGE_SIZE,
    });
    variants = result.items;
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  }

  const basePath = `/catalogue/caravans/${makeSlug}/${modelSlug}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: 'Caravans', href: '/catalogue/caravans' },
          { label: model.make.name, href: `/catalogue/caravans/${makeSlug}` },
          { label: model.name },
        ]}
      />

      <div>
        <h1 className="text-tb-primary text-2xl font-bold">
          {model.make.name} {model.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {model.variants.length}{' '}
          {model.variants.length === 1 ? 'variant' : 'variants'} ·{' '}
          {model.bodyType
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
      </div>

      <Suspense>
        <FilterChips
          paramName="axleConfiguration"
          options={AXLE_CONFIGS}
          label="Axle"
        />
      </Suspense>

      {variants.length === 0 ? (
        <div className="border-tb-neutral-200 rounded-xl border py-16 text-center text-gray-400">
          {axleConfiguration || year
            ? 'No variants match the selected filters.'
            : 'No variants available.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {variants.map((variant) => (
            <VariantCard key={variant.id} variant={variant} />
          ))}
        </div>
      )}

      <PaginationBar
        basePath={basePath}
        searchParams={sp as Record<string, string | undefined>}
        nextCursor={nextCursor}
        hasMore={hasMore}
      />
    </div>
  );
}
