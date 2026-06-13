import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { resolveVariantRedirect } from '@/lib/variant-redirects';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import {
  getCaravanVariantProfileData,
  getAllCaravanVariantSlugsForSSG,
} from '@/modules/catalogue/queries/caravan-profile.queries';
import type {
  CaravanAdjacentRangeLink,
  CaravanSiblingVariantLink,
  CaravanVariantProfileData,
} from '@/modules/catalogue/queries/caravan-profile.queries';
import type { CaravanVariantDto } from '@/modules/catalogue/types/caravan.types';
import type { AxleConfiguration } from '@prisma/client';

export const revalidate = 86400;

// ── Params ─────────────────────────────────────────────────────────────────

interface PageParams {
  make: string;
  model: string;
  variant: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ───────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllCaravanVariantSlugsForSSG();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function coverageYears(v: CaravanVariantDto): number[] {
  const end = v.yearTo;
  return Array.from({ length: end - v.yearFrom + 1 }, (_, i) => v.yearFrom + i);
}

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return `${v.yearFrom}`;
  return `${v.yearFrom}–${v.yearTo}`;
}

function enumerateYearsProse(years: number[]): string {
  if (years.length === 0) return '';
  if (years.length === 1) return `${years[0]}`;
  const init = years.slice(0, -1).join(', ');
  return `${init}, or ${years[years.length - 1]}`;
}

function formatKg(n: number | null): string {
  return n != null ? `${n.toLocaleString()} kg` : '—';
}

function formatMm(n: number | null): string {
  return n != null ? `${n.toLocaleString()} mm` : '—';
}

function formatAxleConfig(config: AxleConfiguration): string {
  switch (config) {
    case 'SINGLE_AXLE':
      return 'Single axle';
    case 'DUAL_AXLE_CLOSE_COUPLED':
      return 'Dual axle (close coupled)';
    case 'DUAL_AXLE_SPREAD':
      return 'Dual axle (spread)';
    case 'TRIPLE_AXLE':
      return 'Triple axle';
    default:
      return config;
  }
}

// ── FAQ builder ─────────────────────────────────────────────────────────────

interface FaqEntry {
  question: string;
  answer: string;
}

interface CaravanMetricDef {
  label: string;
  shortLabel: string;
  key: 'atmKg' | 'gtmKg' | 'tbmKg' | 'tareKg';
}

const CARAVAN_METRICS: CaravanMetricDef[] = [
  { label: 'ATM (aggregate trailer mass)', shortLabel: 'ATM', key: 'atmKg' },
  { label: 'GTM (gross trailer mass)', shortLabel: 'GTM', key: 'gtmKg' },
  { label: 'TBM (tow ball mass)', shortLabel: 'TBM', key: 'tbmKg' },
  { label: 'tare mass', shortLabel: 'tare mass', key: 'tareKg' },
];

function buildFaqs(
  makeName: string,
  modelName: string,
  variantName: string,
  variant: CaravanVariantDto,
): FaqEntry[] {
  const fullName = `${makeName} ${modelName} ${variantName}`;
  const rangeLabel = yearRangeLabel(variant);
  const isSingleYear = variant.yearFrom === variant.yearTo;
  const canonicalTail = isSingleYear
    ? ''
    : ` This specification is unchanged across the entire ${rangeLabel} production run.`;

  const makeEntry = (year: number, m: CaravanMetricDef): FaqEntry | null => {
    const value = variant[m.key] as number | null;
    if (value == null) return null;
    return {
      question: `What is the ${m.label} of the ${year} ${fullName}?`,
      answer: `The ${year} ${fullName} has a ${m.shortLabel} of ${value.toLocaleString()} kg.${canonicalTail}`,
    };
  };

  const entries: FaqEntry[] = [];
  const mostRecent = variant.yearTo;
  const earliest = variant.yearFrom;

  // Priority 1: most-recent year × each metric
  for (const m of CARAVAN_METRICS) {
    if (entries.length >= 15) break;
    const e = makeEntry(mostRecent, m);
    if (e) entries.push(e);
  }

  // Priority 2: earliest year × each metric (skip if same as most-recent)
  if (earliest !== mostRecent) {
    for (const m of CARAVAN_METRICS) {
      if (entries.length >= 15) break;
      const e = makeEntry(earliest, m);
      if (e) entries.push(e);
    }
  }

  // Priority 3: middle years, most-recent first, distributed across metrics to fill cap
  if (entries.length < 15 && mostRecent - earliest > 1) {
    const middleYears = Array.from(
      { length: mostRecent - earliest - 1 },
      (_, i) => mostRecent - 1 - i,
    );
    outer: for (const year of middleYears) {
      for (const m of CARAVAN_METRICS) {
        if (entries.length >= 15) break outer;
        const e = makeEntry(year, m);
        if (e) entries.push(e);
      }
    }
  }

  return entries;
}

// ── JSON-LD builders ────────────────────────────────────────────────────────

function buildVehicleJsonLd(data: CaravanVariantProfileData): object {
  const { variant } = data;
  const make = variant.model.make;
  const model = variant.model;
  const productionEnd = variant.isCurrentProduction
    ? new Date().getFullYear().toString()
    : variant.yearTo.toString();
  const productionDate = `${variant.yearFrom}/${productionEnd}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${make.name} ${model.name} ${variant.name}`,
    manufacturer: { '@type': 'Organization', name: make.name },
    model: model.name,
    vehicleModelDate: productionEnd,
    productionDate,
    ...(variant.atmKg != null
      ? {
          weightTotal: {
            '@type': 'QuantitativeValue',
            value: variant.atmKg,
            unitCode: 'KGM',
          },
        }
      : {}),
    ...(variant.bodyLengthMm != null
      ? {
          depth: {
            '@type': 'QuantitativeValue',
            value: variant.bodyLengthMm / 1000,
            unitCode: 'MTR',
          },
        }
      : {}),
  };
}

function buildFaqJsonLd(faqs: FaqEntry[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make, model, variant } = await params;
  const data = await getCaravanVariantProfileData(make, model, variant);
  if (!data) return { title: 'Not Found' };

  const v = data.variant;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const rangeLabel = yearRangeLabel(v);
  const years = coverageYears(v);

  const title = `${makeName} ${modelName} ${v.name} (${rangeLabel}) — ATM, GTM & Specs`;
  const description = `Complete ATM, GTM, TBM, tare, and body specifications for the ${makeName} ${modelName} ${v.name}. Covers model years ${enumerateYearsProse(years)}. Australian market data.`;

  const canonicalUrl = `/caravans/${make}/${model}/${variant}/`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      images: [{ url: '/og/caravan-default.png', width: 1200, height: 630 }],
    },
  };
}

// ── Spec table ──────────────────────────────────────────────────────────────

function SpecTable({ variant }: { variant: CaravanVariantDto }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'ATM (aggregate trailer mass)', value: formatKg(variant.atmKg) },
    { label: 'GTM (gross trailer mass)', value: formatKg(variant.gtmKg) },
    { label: 'Tare', value: formatKg(variant.tareKg) },
    { label: 'TBM (tow ball mass)', value: formatKg(variant.tbmKg) },
    { label: 'Body length', value: formatMm(variant.bodyLengthMm) },
    {
      label: 'Axle configuration',
      value: formatAxleConfig(variant.axleConfiguration),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
              Specification
            </th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-700">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="px-4 py-2.5 text-gray-600">{row.label}</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Year selector chips ─────────────────────────────────────────────────────

function YearSelector({ years }: { years: number[] }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {years.map((year) => (
          <span
            key={year}
            className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
          >
            {year}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        All these years share the same specifications.
      </p>
    </div>
  );
}

// ── FAQ section ─────────────────────────────────────────────────────────────

function FaqSection({ faqs }: { faqs: FaqEntry[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">
        Frequently Asked Questions
      </h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="font-semibold text-gray-900">{faq.question}</p>
            <p className="mt-1 text-sm text-gray-600">{faq.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Adjacent range + sibling links ──────────────────────────────────────────

function RangeLink({
  link,
  label,
}: {
  link: CaravanAdjacentRangeLink;
  label: string;
}) {
  const href = `/caravans/${link.makeSlug}/${link.modelSlug}/${link.slug}/`;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
    >
      <span className="text-xs tracking-wide text-gray-400 uppercase">
        {label}
      </span>
      <span>
        {link.name} {yearRangeLabel(link)}
      </span>
    </Link>
  );
}

function SiblingLinks({
  siblings,
  modelHref,
  modelName,
}: {
  siblings: CaravanSiblingVariantLink[];
  modelHref: string;
  modelName: string;
}) {
  if (siblings.length === 0) return null;
  const visible = siblings.slice(0, 5);
  const overflow = siblings.length > 5;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        Other {modelName} variants
      </h2>
      <div className="flex flex-wrap gap-2">
        {visible.map((s) => (
          <Link
            key={s.slug}
            href={`/caravans/${s.makeSlug}/${s.modelSlug}/${s.slug}/`}
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
          >
            {s.name}{' '}
            <span className="ml-1 text-xs text-gray-400">
              ({yearRangeLabel(s)})
            </span>
          </Link>
        ))}
        {overflow && (
          <Link
            href={modelHref}
            className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            See all variants
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function CaravanVariantProfilePage({ params }: Props) {
  const { make, model, variant } = await params;
  const data = await getCaravanVariantProfileData(make, model, variant);
  if (!data) {
    const toSlug = await resolveVariantRedirect('CaravanVariant', variant);
    if (toSlug) permanentRedirect(`/caravans/${make}/${model}/${toSlug}/`);
    notFound();
  }

  const v = data.variant;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const years = coverageYears(v);
  const rangeLabel = yearRangeLabel(v);
  const faqs = buildFaqs(makeName, modelName, v.name, v);
  const vehicleJsonLd = buildVehicleJsonLd(data);
  const faqJsonLd = buildFaqJsonLd(faqs);

  const modelHref = `/caravans/${make}/${model}/`;
  const breadcrumbLd = breadcrumbJsonLd([
    { name: 'Caravans', path: '/caravans/' },
    { name: makeName, path: modelHref },
    { name: modelName, path: modelHref },
    { name: v.name, path: `/caravans/${make}/${model}/${v.slug}/` },
  ]);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-1 text-sm text-gray-500">
          <Link href="/caravans" className="hover:text-blue-700">
            Caravans
          </Link>
          <span>/</span>
          <span className="text-gray-900">{makeName}</span>
          <span>/</span>
          <Link href={modelHref} className="hover:text-blue-700">
            {modelName}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{v.name}</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {makeName} {modelName} {v.name} ({rangeLabel})
        </h1>

        {/* Lead paragraph */}
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          If your {modelName} is a {enumerateYearsProse(years)} model, this page
          covers your exact caravan. All specifications on this page — ATM, GTM,
          TBM, and tare — are unchanged across the entire {rangeLabel}{' '}
          production run of the {makeName} {modelName} {v.name}.
        </p>

        {/* Year selector */}
        <div className="mt-6">
          <YearSelector years={years} />
        </div>

        {/* Calculator CTA */}
        <div className="mt-6">
          <Link
            href={`/calculator?c=${v.slug}`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Check your rig with this caravan
          </Link>
        </div>

        {/* Spec table */}
        <div className="mt-10 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            Headline specifications
          </h2>
          <SpecTable variant={v} />
        </div>

        {/* Adjacent-range links */}
        {(data.olderRange || data.newerRange) && (
          <div className="mt-10 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Adjacent production ranges
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              {data.olderRange && (
                <RangeLink link={data.olderRange} label="Older" />
              )}
              {data.newerRange && (
                <RangeLink link={data.newerRange} label="Newer" />
              )}
            </div>
          </div>
        )}

        {/* Sibling variants */}
        <div className="mt-10">
          <SiblingLinks
            siblings={data.siblings}
            modelHref={modelHref}
            modelName={modelName}
          />
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <FaqSection faqs={faqs} />
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-sm font-medium text-blue-900">
            Ready to check your tow vehicle compliance?
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Use the TravellingBuddy calculator to verify your ATM, GTM, and tow
            ball mass before you head out.
          </p>
          <Link
            href={`/calculator?c=${v.slug}`}
            className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Open Calculator
          </Link>
        </div>
      </div>
    </>
  );
}
