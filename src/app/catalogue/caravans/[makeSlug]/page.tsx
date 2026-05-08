import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { createCaravanService } from "@/modules/catalogue/services/caravan.service";
import { ModelCard } from "@/components/catalogue/ModelCard";
import { FilterChips } from "@/components/catalogue/FilterChips";
import { SearchInput } from "@/components/catalogue/SearchInput";
import { PaginationBar } from "@/components/catalogue/PaginationBar";
import { Breadcrumbs } from "@/components/catalogue/Breadcrumbs";

export const dynamic = "force-dynamic";

const service = createCaravanService(prisma);

const BODY_TYPES = [
  { label: "Pop-top", value: "CARAVAN_POP_TOP" },
  { label: "Full Height", value: "CARAVAN_FULL_HEIGHT" },
  { label: "Off-road", value: "OFF_ROAD_CARAVAN" },
  { label: "Camper Trailer", value: "CAMPER_TRAILER" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Fifth Wheeler", value: "FIFTH_WHEELER" },
  { label: "Other", value: "OTHER" },
];

const PAGE_SIZE = 24;

interface Props {
  params: Promise<{ makeSlug: string }>;
  searchParams: Promise<{ q?: string; bodyType?: string; cursor?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { makeSlug } = await params;
  const make = await service.getMakeBySlug(makeSlug);
  if (!make) return { title: "Not Found" };
  return {
    title: make.name,
    description: `Browse ${make.name} caravan models in the TravellingBuddy catalogue.`,
  };
}

export default async function CaravanModelsPage({ params, searchParams }: Props) {
  const { makeSlug } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const bodyType = sp.bodyType;
  const cursor = sp.cursor;

  const make = await service.getMakeBySlug(makeSlug);
  if (!make) notFound();

  let models = make.models;
  let nextCursor: string | null = null;
  let hasMore = false;

  if (q || bodyType) {
    if (q) {
      const results = await service.search(q, 50);
      models = results.models
        .filter((m) => m.makeId === make.id)
        .filter((m) => !bodyType || m.bodyType === bodyType);
    } else {
      models = make.models.filter((m) => m.bodyType === bodyType);
    }
  } else {
    const result = await service.listModelsByMake(make.id, { cursor, limit: PAGE_SIZE });
    models = result.items;
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  }

  const basePath = `/catalogue/caravans/${makeSlug}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: "Caravans", href: "/catalogue/caravans" },
          { label: make.name },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tb-primary">{make.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {make.countryOfOrigin ? `${make.countryOfOrigin} · ` : ""}
            {make.models.length} {make.models.length === 1 ? "model" : "models"}
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Suspense>
            <SearchInput placeholder="Search models..." />
          </Suspense>
        </div>
      </div>

      <Suspense>
        <FilterChips paramName="bodyType" options={BODY_TYPES} label="Body type" />
      </Suspense>

      {models.length === 0 ? (
        <div className="rounded-xl border border-tb-neutral-200 py-16 text-center text-gray-400">
          {q || bodyType ? "No models match the selected filters." : "No models available."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              href={`${basePath}/${model.slug}`}
            />
          ))}
        </div>
      )}

      {!q && !bodyType && (
        <PaginationBar
          basePath={basePath}
          searchParams={sp as Record<string, string | undefined>}
          nextCursor={nextCursor}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}
