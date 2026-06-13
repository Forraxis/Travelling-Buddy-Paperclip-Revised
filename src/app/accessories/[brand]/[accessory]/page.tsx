import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAccessoryProfileData,
  getAllActiveAccessorySlugsForSSG,
} from '@/modules/catalogue/queries/accessory-profile.queries';
import type {
  AccessoryProfileData,
  AccessoryFitmentRow,
} from '@/modules/catalogue/queries/accessory-profile.queries';

export const revalidate = 86400;

// ── Params ─────────────────────────────────────────────────────────────────

interface PageParams {
  brand: string;
  accessory: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ───────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllActiveAccessorySlugsForSSG();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatMountingLocation(loc: string): string {
  return loc
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function uniqueMountingLocations(fitments: AccessoryFitmentRow[]): string[] {
  return [...new Set(fitments.map((f) => f.mountingLocation))].map(
    formatMountingLocation,
  );
}

function representativeWeight(fitments: AccessoryFitmentRow[]): number | null {
  if (fitments.length === 0) return null;
  const weights = fitments.map((f) => f.installedWeightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return min === max ? min : null;
}

function weightRangeLabel(fitments: AccessoryFitmentRow[]): string | null {
  if (fitments.length === 0) return null;
  const weights = fitments.map((f) => f.installedWeightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  if (min === max) return `${min.toFixed(1)} kg`;
  return `${min.toFixed(1)}–${max.toFixed(1)} kg`;
}

function priceRangeLabel(data: AccessoryProfileData): string | null {
  const { priceMin, priceMax, currencyCode } = data.accessory;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null)
    return `${currencyCode} ${priceMin.toFixed(0)}–${priceMax.toFixed(0)}`;
  if (priceMin != null) return `From ${currencyCode} ${priceMin.toFixed(0)}`;
  return `Up to ${currencyCode} ${priceMax!.toFixed(0)}`;
}

function vehicleProfileUrl(v: AccessoryFitmentRow['vehicleVariant']): string {
  if (!v) return '#';
  return `/vehicles/${v.model.make.slug}/${v.model.slug}/${v.slug}/`;
}

function caravanProfileUrl(c: AccessoryFitmentRow['caravanVariant']): string {
  if (!c) return '#';
  return `/caravans/${c.model.make.slug}/${c.model.slug}/${c.slug}/`;
}

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return String(v.yearFrom);
  return `${v.yearFrom}–${v.yearTo}`;
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

function buildProductJsonLd(data: AccessoryProfileData): object {
  const { accessory, brand, category } = data;
  const repWeight = representativeWeight(data.fitments);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand.name} ${accessory.name}`,
    brand: { '@type': 'Brand', name: brand.name },
    category: category.name,
    ...(accessory.description ? { description: accessory.description } : {}),
    ...(accessory.imageUrls.length > 0 ? { image: accessory.imageUrls } : {}),
    ...(repWeight != null
      ? {
          weight: {
            '@type': 'QuantitativeValue',
            value: repWeight,
            unitCode: 'KGM',
          },
        }
      : {}),
    ...(accessory.priceMin != null || accessory.priceMax != null
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: accessory.currencyCode,
            ...(accessory.priceMin != null
              ? { lowPrice: accessory.priceMin }
              : {}),
            ...(accessory.priceMax != null
              ? { highPrice: accessory.priceMax }
              : {}),
          },
        }
      : {}),
  };
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand, accessory } = await params;
  const data = await getAccessoryProfileData(brand, accessory);
  if (!data) return { title: 'Not Found' };

  const title = `${data.brand.name} ${data.accessory.name} — Weight, Fitment & Specs`;
  const fitmentCount = data.fitments.length;
  const weightLabel = weightRangeLabel(data.fitments);

  const description = [
    `${data.brand.name} ${data.accessory.name} specifications`,
    weightLabel ? `— weighs ${weightLabel}` : null,
    fitmentCount > 0
      ? `— fits ${fitmentCount} vehicle/caravan configuration${fitmentCount !== 1 ? 's' : ''}`
      : null,
    `Australian market data.`,
  ]
    .filter(Boolean)
    .join(' ');

  const canonicalUrl = `/accessories/${brand}/${accessory}/`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description },
  };
}

// ── Fitment list ────────────────────────────────────────────────────────────

function FitmentList({ fitments }: { fitments: AccessoryFitmentRow[] }) {
  const vehicleFitments = fitments.filter((f) => f.vehicleVariant != null);
  const caravanFitments = fitments.filter((f) => f.caravanVariant != null);

  if (fitments.length === 0) {
    return (
      <p className="text-sm text-gray-400">No fitment data recorded yet.</p>
    );
  }

  return (
    <div className="space-y-5">
      {vehicleFitments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Vehicles ({vehicleFitments.length})
          </h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {vehicleFitments.map((f) => {
              const v = f.vehicleVariant!;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <Link
                    href={vehicleProfileUrl(v)}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {v.model.make.name} {v.model.name} {v.name}
                  </Link>
                  <span className="ml-4 shrink-0 text-gray-500">
                    {yearRangeLabel(v)} · {f.installedWeightKg.toFixed(1)} kg
                    {f.confidence !== 'VERIFIED' && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({f.confidence.toLowerCase()})
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {caravanFitments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Caravans ({caravanFitments.length})
          </h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {caravanFitments.map((f) => {
              const c = f.caravanVariant!;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <Link
                    href={caravanProfileUrl(c)}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {c.model.make.name} {c.model.name} {c.name}
                  </Link>
                  <span className="ml-4 shrink-0 text-gray-500">
                    {yearRangeLabel(c)} · {f.installedWeightKg.toFixed(1)} kg
                    {f.confidence !== 'VERIFIED' && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({f.confidence.toLowerCase()})
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function AccessoryProfilePage({ params }: Props) {
  const { brand, accessory } = await params;
  const data = await getAccessoryProfileData(brand, accessory);
  if (!data) notFound();

  const {
    accessory: acc,
    brand: brandData,
    category,
    fitments,
    relatedAccessories,
  } = data;

  const canonicalUrl = `/accessories/${brand}/${accessory}/`;
  const productJsonLd = buildProductJsonLd(data);
  const weightLabel = weightRangeLabel(fitments);
  const priceLabel = priceRangeLabel(data);
  const mountingLocations = uniqueMountingLocations(fitments);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* Self-canonical */}
      <link rel="canonical" href={canonicalUrl} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav
          className="mb-6 flex items-center gap-1 text-sm text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link href="/accessories/" className="hover:text-blue-700">
            Accessories
          </Link>
          <span>/</span>
          <Link
            href={`/accessories/${category.slug}/`}
            className="hover:text-blue-700"
          >
            {category.name}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{acc.name}</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {brandData.name} {acc.name}
        </h1>

        {acc.description && (
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            {acc.description}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Left: image */}
          {acc.imageUrls.length > 0 && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={acc.imageUrls[0]}
                alt={`${brandData.name} ${acc.name}`}
                className="w-full rounded-xl border border-gray-200 object-cover"
              />
            </div>
          )}

          {/* Right: spec card */}
          <div className="space-y-4">
            {/* Spec table */}
            <div className="rounded-xl border border-gray-200 bg-gray-50">
              <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-semibold tracking-wide text-gray-600 uppercase">
                Specifications
              </h2>
              <dl className="divide-y divide-gray-100">
                {weightLabel && (
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <dt className="font-medium text-gray-700">Weight</dt>
                    <dd className="text-gray-900">{weightLabel}</dd>
                  </div>
                )}
                {priceLabel && (
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <dt className="font-medium text-gray-700">Price range</dt>
                    <dd className="text-gray-900">{priceLabel}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <dt className="font-medium text-gray-700">Category</dt>
                  <dd>
                    <Link
                      href={`/accessories/${category.slug}/`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {category.name}
                    </Link>
                  </dd>
                </div>
                {mountingLocations.length > 0 && (
                  <div className="flex items-start justify-between px-5 py-3 text-sm">
                    <dt className="font-medium text-gray-700">Mounting</dt>
                    <dd className="text-right text-gray-900">
                      {mountingLocations.join(', ')}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <dt className="font-medium text-gray-700">Brand</dt>
                  <dd className="text-gray-900">{brandData.name}</dd>
                </div>
              </dl>
            </div>

            {/* Affiliate CTA */}
            {acc.affiliateUrl && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800">
                  Sponsored — partner link
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  We may receive a commission if you purchase through this link
                  at no extra cost to you.
                </p>
                <a
                  href={acc.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  View on retailer site ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Fitment list */}
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Fitment list ({fitments.length})
          </h2>
          <FitmentList fitments={fitments} />
        </div>

        {/* Calculator CTA */}
        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm font-semibold text-blue-900">
            Check your towing compliance
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Use the TravellingBuddy calculator to see how the {brandData.name}{' '}
            {acc.name} affects your rig&apos;s GVM, GCM, and tow capacity.
          </p>
          <Link
            href="/calculator/"
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Open Towing Calculator
          </Link>
        </div>

        {/* Related accessories */}
        {relatedAccessories.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              More {category.name}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {relatedAccessories.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/accessories/${rel.brand.slug}/${rel.slug}/`}
                  className="group rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm"
                >
                  <p className="text-xs text-gray-500">{rel.brand.name}</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                    {rel.name}
                  </p>
                  {(rel.priceMin != null || rel.priceMax != null) && (
                    <p className="mt-1 text-xs text-gray-500">
                      {rel.priceMin != null
                        ? `From ${rel.currencyCode} ${rel.priceMin.toFixed(0)}`
                        : `Up to ${rel.currencyCode} ${rel.priceMax!.toFixed(0)}`}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
