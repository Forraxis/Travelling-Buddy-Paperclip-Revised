import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import {
  getConfirmedModelPageData,
  getAllConfirmedModelSlugsForSSG,
  CONFIRMED_SPEC_FIELDS,
} from '@/modules/catalogue/queries/confirmed-spec.queries';
import type {
  ConfirmedModelPageData,
  ConfirmedSpecField,
  ConfirmedVariantRow,
} from '@/modules/catalogue/queries/confirmed-spec.queries';
import {
  CONFIRMED_FIELD_META,
  formatConfirmedValue,
  sourceLabel,
} from '@/modules/catalogue/lib/confirmed-spec-fields';

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
  return getAllConfirmedModelSlugsForSSG();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return `${v.yearFrom}`;
  return `${v.yearFrom}–${v.yearTo}`;
}

/** Fields that at least one variant actually publishes — drives the table columns. */
function presentFields(data: ConfirmedModelPageData): ConfirmedSpecField[] {
  return CONFIRMED_SPEC_FIELDS.filter((f) =>
    data.variants.some((v) => v.cells[f] != null),
  );
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

function buildItemListJsonLd(
  data: ConfirmedModelPageData,
  canonicalUrl: string,
): object {
  const { make, model, variants } = data;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${make.name} ${model.name} — Confirmed Specifications`,
    url: canonicalUrl,
    itemListElement: variants.map((v, i) => {
      const gvm = v.cells.gvmKg;
      const tow = v.cells.maxTowingCapacityKg;
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Car',
          name: `${make.name} ${model.name} ${v.name}`,
          manufacturer: { '@type': 'Organization', name: make.name },
          model: model.name,
          ...(gvm
            ? {
                weightTotal: {
                  '@type': 'QuantitativeValue',
                  value: Number(gvm.value),
                  unitCode: 'KGM',
                },
              }
            : {}),
          ...(tow
            ? {
                towingCapacity: {
                  '@type': 'QuantitativeValue',
                  value: Number(tow.value),
                  unitCode: 'KGM',
                },
              }
            : {}),
        },
      };
    }),
  };
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make, model } = await params;
  const data = await getConfirmedModelPageData(make, model);
  if (!data) return { title: 'Not Found' };

  const makeName = data.make.name;
  const modelName = data.model.name;
  const variantCount = data.variants.length;
  const canonicalUrl = `/vehicles/confirmed/${make}/${model}/`;

  const title = `${makeName} ${modelName} — Confirmed Specifications (ROVER-sourced)`;
  const description = `Confirmed, source-verified GVM, GCM, towing capacity and axle limits for ${variantCount} ${makeName} ${modelName} variant${variantCount !== 1 ? 's' : ''}. Every figure is provenance-stamped from a federal RVSA approval${data.latestAsOf ? `, current as at ${data.latestAsOf}` : ''}.`;

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

// ── Disclaimer (surfaced near figures — VEHICLE_DATA_FETCH.md §6) ────────────

function Disclaimer() {
  return (
    <p className="mt-3 text-xs leading-relaxed text-gray-500">
      Every figure below is{' '}
      <span className="font-medium text-gray-700">confirmed</span> — sourced
      from a federal RVSA approval (ROVER), plate, or cross-verified — and
      stamped with its source and date. AI-estimated values are never shown
      here. Always confirm the figures against your own vehicle&apos;s
      compliance plate before relying on them for a towing-compliance decision.
    </p>
  );
}

// ── Confirmed-spec table ─────────────────────────────────────────────────────

function ConfirmedTable({
  variants,
  fields,
}: {
  variants: ConfirmedVariantRow[];
  fields: ConfirmedSpecField[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
              Variant
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
              Years
            </th>
            {fields.map((f) => (
              <th
                key={f}
                className="px-4 py-2.5 text-right font-semibold text-gray-700"
              >
                {CONFIRMED_FIELD_META[f].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => (
            <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2.5 font-medium text-gray-900">
                {v.name}
              </td>
              <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                {yearRangeLabel(v)}
              </td>
              {fields.map((f) => {
                const cell = v.cells[f];
                return (
                  <td
                    key={f}
                    className="px-4 py-2.5 text-right text-gray-900 tabular-nums"
                  >
                    {cell ? formatConfirmedValue(f, cell.value) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Provenance card (per variant) ────────────────────────────────────────────

function ProvenanceCard({
  variant,
  fields,
}: {
  variant: ConfirmedVariantRow;
  fields: ConfirmedSpecField[];
}) {
  const cells = fields
    .map((f) => variant.cells[f])
    .filter((c): c is NonNullable<typeof c> => c != null);
  if (cells.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">
        {variant.name}{' '}
        <span className="text-sm font-normal text-gray-400">
          ({yearRangeLabel(variant)})
        </span>
      </h3>
      <dl className="mt-3 divide-y divide-gray-100">
        {cells.map((cell) => (
          <div
            key={cell.field}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
          >
            <dt className="text-sm text-gray-600">
              {CONFIRMED_FIELD_META[cell.field].label}
            </dt>
            <dd className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-900 tabular-nums">
                {formatConfirmedValue(cell.field, cell.value)}
              </span>
              <span className="text-xs text-gray-400">
                {cell.sourceUrl ? (
                  <a
                    href={cell.sourceUrl}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="hover:text-blue-600 hover:underline"
                  >
                    {sourceLabel(cell.source)}
                  </a>
                ) : (
                  sourceLabel(cell.source)
                )}{' '}
                · as at {cell.asOf}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function ConfirmedSpecModelPage({ params }: Props) {
  const { make, model } = await params;
  const data = await getConfirmedModelPageData(make, model);
  if (!data) notFound();

  const makeName = data.make.name;
  const modelName = data.model.name;
  const variantCount = data.variants.length;
  const fields = presentFields(data);

  const canonicalUrl = `/vehicles/confirmed/${make}/${model}/`;
  const editorialHref = `/vehicles/${data.make.slug}/${data.model.slug}/`;

  const itemListJsonLd = buildItemListJsonLd(data, canonicalUrl);
  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Vehicles', path: '/vehicles/' },
    { name: makeName, path: editorialHref },
    { name: modelName, path: editorialHref },
    { name: 'Confirmed specifications', path: canonicalUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* Self-canonical — one model page, never one per variant (thin-content guard). */}
      <link rel="canonical" href={canonicalUrl} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-1 text-sm text-gray-500">
          <Link href="/vehicles" className="hover:text-blue-700">
            Vehicles
          </Link>
          <span>/</span>
          <Link href={editorialHref} className="hover:text-blue-700">
            {makeName} {modelName}
          </Link>
          <span>/</span>
          <span className="text-gray-900">Confirmed specifications</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {makeName} {modelName} — confirmed specifications
        </h1>

        {/* Lead + disclaimer near figures */}
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          Source-verified compliance figures for {variantCount} catalogued{' '}
          {makeName} {modelName} variant{variantCount !== 1 ? 's' : ''}. Only
          confirmed data is published on this page
          {data.latestAsOf ? `, current as at ${data.latestAsOf}` : ''}.
        </p>
        <Disclaimer />

        {/* Variant table */}
        <div className="mt-10 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            Confirmed figures by variant
          </h2>
          <ConfirmedTable variants={data.variants} fields={fields} />
        </div>

        {/* Per-variant provenance detail */}
        <div className="mt-10 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            Where these figures come from
          </h2>
          <p className="text-sm text-gray-500">
            Each figure carries its source and the date it was confirmed.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.variants.map((v) => (
              <ProvenanceCard key={v.id} variant={v} fields={fields} />
            ))}
          </div>
        </div>

        {/* Link to the editorial model page */}
        <p className="mt-10 text-sm text-gray-500">
          Looking for the full {modelName} overview, year-by-year coverage and
          FAQs?{' '}
          <Link
            href={editorialHref}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            See the {makeName} {modelName} model page
          </Link>
          .
        </p>

        {/* Calculator CTA */}
        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm font-medium text-blue-900">
            Know which {modelName} you have?
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Use the TravellingBuddy calculator to check your GVM, GCM and axle
            loads against these confirmed limits before you head out.
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
