import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { VehicleBodyType } from "@prisma/client";
import {
  getVehicleModelPageData,
  getAllVehicleModelSlugsForSSG,
} from "@/modules/catalogue/queries/vehicle-profile.queries";
import type {
  VehicleModelPageData,
  VehicleModelVariantRow,
} from "@/modules/catalogue/queries/vehicle-profile.queries";

export const revalidate = 86400;

// ── Params ─────────────────────────────────────────────────────────────────

interface PageParams {
  make: string;
  model: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ───────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllVehicleModelSlugsForSSG();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function yearRangeLabel(v: { yearFrom: number; yearTo: number; isCurrentProduction: boolean }): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return `${v.yearFrom}`;
  return `${v.yearFrom}–${v.yearTo}`;
}

function formatKg(n: number | null): string {
  return n != null ? n.toLocaleString() : "—";
}

function bodyTypeLabel(bodyType: VehicleBodyType): string {
  switch (bodyType) {
    case "DUAL_CAB_UTE": return "dual-cab ute";
    case "SINGLE_CAB_UTE": return "single-cab ute";
    case "EXTRA_CAB_UTE": return "extra-cab ute";
    case "WAGON": return "wagon";
    case "SUV": return "SUV";
    case "VAN": return "van";
    case "TROOPCARRIER": return "troopcarrier";
    default: return "vehicle";
  }
}

interface VariantGroup {
  name: string;
  rows: VehicleModelVariantRow[];
}

function groupVariants(variants: VehicleModelVariantRow[]): VariantGroup[] {
  const map = new Map<string, VehicleModelVariantRow[]>();
  for (const v of variants) {
    const bucket = map.get(v.name) ?? [];
    bucket.push(v);
    map.set(v.name, bucket);
  }
  // Sort within each group by yearFrom desc; order groups by their max yearFrom desc
  return Array.from(map.entries())
    .map(([name, rows]) => ({
      name,
      rows: [...rows].sort((a, b) => b.yearFrom - a.yearFrom),
    }))
    .sort((a, b) => b.rows[0].yearFrom - a.rows[0].yearFrom);
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

function buildItemListJsonLd(data: VehicleModelPageData): object {
  const { make, model, variants } = data;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${make.name} ${model.name} — All Variants`,
    itemListElement: variants.map((v, i) => {
      const productionEnd = v.isCurrentProduction
        ? new Date().getFullYear().toString()
        : v.yearTo.toString();
      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Car",
          name: `${make.name} ${model.name} ${v.name}`,
          manufacturer: { "@type": "Organization", name: make.name },
          model: model.name,
          productionDate: `${v.yearFrom}/${productionEnd}`,
          ...(v.maxTowingCapacityKg != null
            ? { towingCapacity: { "@type": "QuantitativeValue", value: v.maxTowingCapacityKg, unitCode: "KGM" } }
            : {}),
          ...(v.gvmKg != null
            ? { weightTotal: { "@type": "QuantitativeValue", value: v.gvmKg, unitCode: "KGM" } }
            : {}),
          url: `/vehicles/${make.slug}/${model.slug}/${v.slug}/`,
        },
      };
    }),
  };
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make, model } = await params;
  const data = await getVehicleModelPageData(make, model);
  if (!data) return { title: "Not Found" };

  const makeName = data.make.name;
  const modelName = data.model.name;
  const variantCount = data.variants.length;

  const allYearFrom = data.variants.map((v) => v.yearFrom);
  const allYearTo = data.variants.map((v) => v.yearTo);
  const earliestYear = allYearFrom.length > 0 ? Math.min(...allYearFrom) : null;
  const latestYear = allYearTo.length > 0 ? Math.max(...allYearTo) : null;
  const hasCurrentProduction = data.variants.some((v) => v.isCurrentProduction);

  const yearRangeStr =
    earliestYear != null && latestYear != null
      ? hasCurrentProduction
        ? `${earliestYear}–present`
        : `${earliestYear}–${latestYear}`
      : "";

  const title = `${makeName} ${modelName} — All Variants, Specifications & Towing Capacity`;
  const description = `Compare all ${variantCount} ${makeName} ${modelName} variants${yearRangeStr ? ` (${yearRangeStr})` : ""}. GVM, GCM, and maximum towing capacity for every catalogued configuration. Australian market data.`;
  const canonicalUrl = `/vehicles/${make}/${model}/`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      images: [{ url: "/og/vehicle-default.png", width: 1200, height: 630 }],
    },
  };
}

// ── Variant table ───────────────────────────────────────────────────────────

function VariantTable({
  groups,
  makeSlug,
  modelSlug,
}: {
  groups: VariantGroup[];
  makeSlug: string;
  modelSlug: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Variant</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Years</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-700">GVM (kg)</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-700">GCM (kg)</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Max towing (kg)</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Specs</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            group.rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-2.5 text-gray-600 tabular-nums">{yearRangeLabel(row)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatKg(row.gvmKg)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatKg(row.gcmKg)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatKg(row.maxTowingCapacityKg)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/vehicles/${makeSlug}/${modelSlug}/${row.slug}/`}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function VehicleModelPage({ params }: Props) {
  const { make, model } = await params;
  const data = await getVehicleModelPageData(make, model);
  if (!data) notFound();

  const makeName = data.make.name;
  const modelName = data.model.name;
  const groups = groupVariants(data.variants);
  const variantCount = data.variants.length;

  const allYearFrom = data.variants.map((v) => v.yearFrom);
  const allYearTo = data.variants.map((v) => v.yearTo);
  const earliestYear = allYearFrom.length > 0 ? Math.min(...allYearFrom) : null;
  const latestYear = allYearTo.length > 0 ? Math.max(...allYearTo) : null;
  const hasCurrentProduction = data.variants.some((v) => v.isCurrentProduction);
  const bodyLabel = bodyTypeLabel(data.model.bodyType);

  const itemListJsonLd = buildItemListJsonLd(data);
  const canonicalUrl = `/vehicles/${make}/${model}/`;

  // Lead: "earliest year_from, body type, generation count/context"
  const spanStr =
    earliestYear != null
      ? hasCurrentProduction
        ? `from ${earliestYear} to the present day`
        : earliestYear === latestYear
        ? `in ${earliestYear}`
        : `from ${earliestYear} to ${latestYear}`
      : "";

  const groupCount = groups.length;

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Self-canonical */}
      <link rel="canonical" href={canonicalUrl} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-1 text-sm text-gray-500">
          <Link href="/vehicles" className="hover:text-blue-700">Vehicles</Link>
          <span>/</span>
          <span className="text-gray-900">{makeName}</span>
          <span>/</span>
          <span className="text-gray-900">{modelName}</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {makeName} {modelName}
        </h1>

        {/* Lead paragraph */}
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          The {makeName} {modelName} is a {bodyLabel} produced {spanStr}
          {variantCount > 0 && (
            <>
              {". "}
              This page lists all {variantCount} catalogued variant{variantCount !== 1 ? "s" : ""}
              {groupCount > 1 ? ` across ${groupCount} distinct configurations` : ""}
              , each with GVM, GCM, and maximum towing capacity specifications for Australian-market vehicles.
            </>
          )}
        </p>

        {/* Variant table */}
        {groups.length > 0 ? (
          <div className="mt-10 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">All variants</h2>
            <VariantTable
              groups={groups}
              makeSlug={data.make.slug}
              modelSlug={data.model.slug}
            />
          </div>
        ) : (
          <p className="mt-10 text-sm text-gray-500">
            No catalogued variants found for this model.
          </p>
        )}

        {/* Calculator CTA */}
        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm font-medium text-blue-900">
            Know which {modelName} you have?
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Select your exact variant above to view its full specifications, then use the
            TravellingBuddy calculator to check your towing compliance.
          </p>
          <Link
            href="/calculator/"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Open Towing Calculator
          </Link>
        </div>
      </div>
    </>
  );
}
