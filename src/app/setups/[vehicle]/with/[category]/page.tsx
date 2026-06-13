import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getVehicleAccessoryComboPageData,
  getAllVehicleAccessoryComboPairsForSSG,
} from '@/modules/catalogue/queries/vehicle-accessory-combo.queries';
import type {
  VehicleAccessoryComboPageData,
  VehicleAccessoryComboRelatedCategory,
} from '@/modules/catalogue/queries/vehicle-accessory-combo.queries';

export const revalidate = 86400;

// ── Params ─────────────────────────────────────────────────────────────────

interface PageParams {
  vehicle: string;
  category: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ───────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllVehicleAccessoryComboPairsForSSG();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return String(v.yearFrom);
  return `${v.yearFrom}–${v.yearTo}`;
}

function formatKg(n: number | null): string {
  return n != null ? `${n.toLocaleString()} kg` : '—';
}

function headroomClass(kg: number | null): string {
  if (kg == null) return 'text-gray-500';
  if (kg < 0) return 'text-red-600 font-semibold';
  if (kg < 100) return 'text-amber-600 font-semibold';
  return 'text-green-700';
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

function buildItemListJsonLd(data: VehicleAccessoryComboPageData): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${data.vehicle.model.make.name} ${data.vehicle.model.name} ${data.vehicle.name} — ${data.category.name}`,
    itemListElement: data.accessories.map((acc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: acc.name,
        brand: { '@type': 'Brand', name: acc.brandName },
        url: `/accessories/${acc.brandSlug}/${acc.slug}/`,
        ...(acc.priceMin != null
          ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: acc.currencyCode,
                price: acc.priceMin.toFixed(2),
                availability: 'https://schema.org/InStock',
              },
            }
          : {}),
        weight: {
          '@type': 'QuantitativeValue',
          value: acc.installedWeightKg,
          unitCode: 'KGM',
        },
      },
    })),
  };
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vehicle, category } = await params;
  const data = await getVehicleAccessoryComboPageData(vehicle, category);
  if (!data) return { title: 'Not Found' };

  const { vehicle: v, category: cat } = data;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const rangeLabel = yearRangeLabel(v);

  const title = `${makeName} ${modelName} + ${cat.name}: Weight Impact & GVM Guide`;
  const description =
    `${makeName} ${modelName} ${v.name} (${rangeLabel}) with ${cat.name} — ` +
    `GVM headroom before: ${formatKg(data.gvmHeadroomBeforeKg)}. ` +
    `${data.accessories.length} ${cat.name.toLowerCase()} options with individual weight impact and ` +
    `GVM headroom calculations. Combined impact: ${formatKg(data.combinedWeightKg)}.`;

  const canonicalUrl = `/setups/${vehicle}/with/${category}/`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      images: [{ url: '/og/vehicle-default.png', width: 1200, height: 630 }],
    },
  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function GvmContextSection({ data }: { data: VehicleAccessoryComboPageData }) {
  const { vehicle: v, gvmHeadroomBeforeKg } = data;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">
        GVM headroom before accessories
      </h2>
      <p className="text-sm text-gray-600">
        Before adding any {data.category.name.toLowerCase()}, here is the{' '}
        {v.model.make.name} {v.model.name} {v.name}&apos;s available GVM
        headroom — the total load capacity covering passengers, fuel,
        accessories, water, and cargo.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-1">
        <SpecRow label="GVM (gross vehicle mass)" value={formatKg(v.gvmKg)} />
        <SpecRow
          label="Kerb weight (unladen)"
          value={formatKg(v.kerbWeightKg)}
        />
        <SpecRow
          label="Available GVM headroom"
          value={formatKg(gvmHeadroomBeforeKg)}
        />
      </div>
      {gvmHeadroomBeforeKg != null && (
        <p className="text-xs text-gray-500">
          The <strong>{formatKg(gvmHeadroomBeforeKg)} headroom</strong> must
          cover all passengers, fuel, accessories, water, food, and camping gear
          combined. The figures below show how each{' '}
          {data.category.name.toLowerCase()} option reduces this headroom.
        </p>
      )}
    </section>
  );
}

function AccessoryListSection({
  data,
}: {
  data: VehicleAccessoryComboPageData;
}) {
  const { vehicle: v, category, accessories } = data;
  const fullName = `${v.model.make.name} ${v.model.name} ${v.name}`;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">
        {category.name} options for the {fullName}
      </h2>
      {category.description && (
        <p className="text-sm text-gray-600">{category.description}</p>
      )}
      <p className="text-sm text-gray-600">
        {accessories.length} {category.name.toLowerCase()} accessories with
        confirmed fitment data for this variant. GVM headroom shown is the
        remaining available payload <em>after</em> adding that single accessory.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <th className="py-3 pr-4 pl-4 text-left">Accessory</th>
              <th className="py-3 pr-4 text-right">Weight</th>
              <th className="py-3 pr-4 text-right">GVM headroom after</th>
              <th className="py-3 pr-2 text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {accessories.map((acc) => (
              <tr
                key={acc.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                <td className="py-3 pr-4 pl-4">
                  <Link
                    href={`/accessories/${acc.brandSlug}/${acc.slug}/`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {acc.name}
                  </Link>
                  <p className="text-xs text-gray-500">{acc.brandName}</p>
                </td>
                <td className="py-3 pr-4 text-right text-gray-700 tabular-nums">
                  {acc.installedWeightKg.toFixed(1)} kg
                </td>
                <td
                  className={`py-3 pr-4 text-right tabular-nums ${headroomClass(acc.gvmHeadroomAfterKg)}`}
                >
                  {formatKg(acc.gvmHeadroomAfterKg)}
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/accessories/${acc.brandSlug}/${acc.slug}/`}
                      className="inline-flex items-center rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Profile
                    </Link>
                    {acc.affiliateUrl && (
                      <a
                        href={acc.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        Buy ↗
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.accessories.some((a) => a.affiliateUrl) && (
        <p className="text-xs text-gray-400">
          ↗ Sponsored links — we may receive a commission at no extra cost to
          you.
        </p>
      )}
    </section>
  );
}

function CombinedImpactSection({
  data,
}: {
  data: VehicleAccessoryComboPageData;
}) {
  const {
    category,
    combinedWeightKg,
    combinedGvmHeadroomAfterKg,
    gvmHeadroomBeforeKg,
  } = data;
  const accessorySlugs = data.accessories.map((a) => a.slug).join(',');
  const calculatorHref = `/calculator?v=${data.vehicle.slug}&a=${accessorySlugs}`;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">Combined impact</h2>
      <p className="text-sm text-gray-600">
        If you added <em>all</em> listed {category.name.toLowerCase()}{' '}
        accessories to this vehicle, here is the total weight impact and
        remaining GVM headroom.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-1">
        <SpecRow
          label="Available GVM headroom before"
          value={formatKg(gvmHeadroomBeforeKg)}
        />
        <SpecRow
          label={`Total ${category.name.toLowerCase()} weight`}
          value={formatKg(combinedWeightKg)}
        />
        <SpecRow
          label="GVM headroom remaining after all"
          value={formatKg(combinedGvmHeadroomAfterKg)}
        />
      </div>
      {combinedGvmHeadroomAfterKg != null && combinedGvmHeadroomAfterKg < 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Adding all {data.accessories.length} accessories exceeds the stock
          GVM. You would need either a GVM upgrade or to reduce the number of
          accessories fitted.
        </div>
      )}
      <div className="pt-2">
        <Link
          href={calculatorHref}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Pre-fill calculator with all {category.name.toLowerCase()} →
        </Link>
      </div>
    </section>
  );
}

function RelatedCategoriesSection({
  vehicleCompound,
  fullName,
  relatedCategories,
}: {
  vehicleCompound: string;
  fullName: string;
  relatedCategories: VehicleAccessoryComboRelatedCategory[];
}) {
  if (relatedCategories.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        Other accessory categories for the {fullName}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {relatedCategories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/setups/${vehicleCompound}/with/${cat.slug}/`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
          >
            <span className="font-medium">{cat.name}</span>
            <span className="text-xs text-gray-400">
              {cat.accessoryCount} options
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function VehicleAccessoryComboPage({ params }: Props) {
  const { vehicle, category } = await params;
  const data = await getVehicleAccessoryComboPageData(vehicle, category);
  if (!data) notFound();

  const { vehicle: v, category: cat } = data;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const rangeLabel = yearRangeLabel(v);
  const fullName = `${makeName} ${modelName} ${v.name}`;
  const canonicalUrl = `/setups/${vehicle}/with/${category}/`;
  const vehicleProfileHref = `/vehicles/${v.model.make.slug}/${v.model.slug}/${v.slug}/`;
  const touringSetupHref = `/touring-setups/${vehicle}/`;
  const allAccessorySlugs = data.accessories.map((a) => a.slug).join(',');
  const calculatorHref = `/calculator?v=${v.slug}&a=${allAccessorySlugs}`;

  const itemListJsonLd = buildItemListJsonLd(data);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {/* Self-canonical */}
      <link rel="canonical" href={canonicalUrl} />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav
          className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link href="/vehicles/" className="hover:text-blue-700">
            Vehicles
          </Link>
          <span>/</span>
          <Link href={vehicleProfileHref} className="hover:text-blue-700">
            {makeName} {modelName}
          </Link>
          <span>/</span>
          <Link href={touringSetupHref} className="hover:text-blue-700">
            Setup guide
          </Link>
          <span>/</span>
          <span className="text-gray-900">{cat.name}</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {fullName} with {cat.name}: What You Need to Know
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-base text-gray-500">{rangeLabel}</p>

        {/* Lead */}
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          This page covers {cat.name.toLowerCase()} accessories with confirmed
          fitment data for the {fullName}. For each option, you can see the
          installed weight and the GVM headroom remaining on this vehicle after
          adding it.
        </p>

        {/* Calculator CTA */}
        <div className="mt-6">
          <Link
            href={calculatorHref}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open calculator with this vehicle →
          </Link>
        </div>

        {/* GVM context */}
        <div className="mt-10">
          <GvmContextSection data={data} />
        </div>

        {/* Accessory list */}
        <div className="mt-10">
          <AccessoryListSection data={data} />
        </div>

        {/* Combined impact */}
        <div className="mt-10">
          <CombinedImpactSection data={data} />
        </div>

        {/* Internal links */}
        <div className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Related pages</h2>
          <div className="flex flex-col gap-2">
            <Link
              href={vehicleProfileHref}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
            >
              <span className="font-medium">{fullName} — full specs</span>
              <span className="text-xs text-gray-400">GVM · GCM · axles</span>
            </Link>
            <Link
              href={touringSetupHref}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
            >
              <span className="font-medium">
                {fullName} — full touring setup guide
              </span>
              <span className="text-xs text-gray-400">All accessories</span>
            </Link>
          </div>
        </div>

        {/* Related category combo pages */}
        {data.relatedCategories.length > 0 && (
          <div className="mt-8">
            <RelatedCategoriesSection
              vehicleCompound={vehicle}
              fullName={fullName}
              relatedCategories={data.relatedCategories}
            />
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-sm font-medium text-blue-900">
            Know your exact load before you leave
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Use the TravellingBuddy calculator to verify GVM, axle limits, and
            towing compliance with your specific accessory list, passengers,
            fuel, and cargo.
          </p>
          <Link
            href={calculatorHref}
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Open Calculator
          </Link>
        </div>
      </div>
    </>
  );
}
