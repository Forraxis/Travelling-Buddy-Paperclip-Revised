import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { createVehicleService } from "@/modules/catalogue/services/vehicle.service";
import { VariantCard } from "@/components/catalogue/VariantCard";
import { FilterChips } from "@/components/catalogue/FilterChips";
import { PaginationBar } from "@/components/catalogue/PaginationBar";
import { Breadcrumbs } from "@/components/catalogue/Breadcrumbs";

export const dynamic = "force-dynamic";

const service = createVehicleService(prisma);

const FUEL_TYPES = [
  { label: "Diesel", value: "DIESEL" },
  { label: "Petrol", value: "PETROL" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Electric", value: "ELECTRIC" },
];

const PAGE_SIZE = 20;

interface Props {
  params: Promise<{ makeSlug: string; modelSlug: string }>;
  searchParams: Promise<{ fuelType?: string; year?: string; cursor?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { makeSlug, modelSlug } = await params;
  const model = await service.getModelBySlug(makeSlug, modelSlug);
  if (!model) return { title: "Not Found" };
  return {
    title: `${model.make.name} ${model.name}`,
    description: `Browse ${model.make.name} ${model.name} variants in the TravellingBuddy catalogue.`,
  };
}

export default async function VehicleVariantsPage({ params, searchParams }: Props) {
  const { makeSlug, modelSlug } = await params;
  const sp = await searchParams;
  const fuelType = sp.fuelType;
  const year = sp.year ? parseInt(sp.year, 10) : undefined;
  const cursor = sp.cursor;

  const model = await service.getModelBySlug(makeSlug, modelSlug);
  if (!model) notFound();

  let variants;
  let nextCursor: string | null = null;
  let hasMore = false;

  if (fuelType || year !== undefined) {
    const result = await service.listVariantsFiltered(
      {
        ...(fuelType ? { fuelType: fuelType as Parameters<typeof service.listVariantsFiltered>[0]["fuelType"] } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      { limit: PAGE_SIZE, cursor }
    );
    variants = result.items.filter((v) => v.modelId === model.id);
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  } else {
    const result = await service.listVariantsByModel(model.id, { cursor, limit: PAGE_SIZE });
    variants = result.items;
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  }

  const basePath = `/catalogue/vehicles/${makeSlug}/${modelSlug}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: "Vehicles", href: "/catalogue/vehicles" },
          { label: model.make.name, href: `/catalogue/vehicles/${makeSlug}` },
          { label: model.name },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-tb-primary">
          {model.make.name} {model.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {model.variants.length} {model.variants.length === 1 ? "variant" : "variants"} ·{" "}
          {model.bodyType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Suspense>
          <FilterChips paramName="fuelType" options={FUEL_TYPES} label="Fuel" />
        </Suspense>
      </div>

      {variants.length === 0 ? (
        <div className="rounded-xl border border-tb-neutral-200 py-16 text-center text-gray-400">
          {fuelType || year ? "No variants match the selected filters." : "No variants available."}
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
