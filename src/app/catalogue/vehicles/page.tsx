import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { createVehicleService } from "@/modules/catalogue/services/vehicle.service";
import { MakeCard } from "@/components/catalogue/MakeCard";
import { SearchInput } from "@/components/catalogue/SearchInput";
import { PaginationBar } from "@/components/catalogue/PaginationBar";
import { Breadcrumbs } from "@/components/catalogue/Breadcrumbs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicles",
  description: "Browse vehicle makes in the TravellingBuddy catalogue.",
};

const service = createVehicleService(prisma);

const PAGE_SIZE = 24;

interface Props {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}

export default async function VehicleMakesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const cursor = params.cursor;

  let makes;
  let nextCursor: string | null = null;
  let hasMore = false;

  if (q) {
    const results = await service.search(q, 50);
    makes = results.makes;
  } else {
    const result = await service.listMakes({ cursor, limit: PAGE_SIZE });
    makes = result.items;
    nextCursor = result.nextCursor;
    hasMore = result.hasMore;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        crumbs={[
          { label: "Catalogue", href: "/catalogue/vehicles" },
          { label: "Vehicles" },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tb-primary">Vehicles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse all vehicle makes in the catalogue.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Suspense>
            <SearchInput placeholder="Search makes..." />
          </Suspense>
        </div>
      </div>

      {makes.length === 0 ? (
        <div className="rounded-xl border border-tb-neutral-200 py-16 text-center text-gray-400">
          {q ? `No makes match "${q}".` : "No vehicle makes in the catalogue yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {makes.map((make) => (
            <MakeCard
              key={make.id}
              make={make}
              href={`/catalogue/vehicles/${make.slug}`}
            />
          ))}
        </div>
      )}

      {!q && (
        <PaginationBar
          basePath="/catalogue/vehicles"
          searchParams={params as Record<string, string | undefined>}
          nextCursor={nextCursor}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}
