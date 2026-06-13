import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getTouringRigPageData,
  getAllTouringRigSlugsForSSG,
} from '@/modules/catalogue/queries/touring-rig.queries';
import type {
  TouringRigPageData,
  TouringRigVariant,
  TouringAccessoryRow,
} from '@/modules/catalogue/queries/touring-rig.queries';

export const revalidate = 86400;

// ── Params ────────────────────────────────────────────────────────────────────

interface PageParams {
  vehicle: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ─────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllTouringRigSlugsForSSG();
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return `${v.yearFrom}`;
  return `${v.yearFrom}–${v.yearTo}`;
}

function formatKg(n: number | null): string {
  return n != null ? `${n.toLocaleString()} kg` : '—';
}

function gvmHeadroom(v: TouringRigVariant): number | null {
  if (v.gvmKg == null || v.kerbWeightKg == null) return null;
  return v.gvmKg - v.kerbWeightKg;
}

function gvmClass(gvmKg: number | null): string {
  if (gvmKg == null) return 'unknown GVM class';
  if (gvmKg <= 3000) return 'light-duty (GVM ≤ 3,000 kg)';
  if (gvmKg <= 4500) return 'medium-duty (GVM 3,001–4,500 kg)';
  return 'heavy-duty (GVM > 4,500 kg)';
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────

function buildVehicleJsonLd(data: TouringRigPageData): object {
  const { variant: v } = data;
  const productionEnd = v.isCurrentProduction
    ? new Date().getFullYear().toString()
    : v.yearTo.toString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${v.model.make.name} ${v.model.name} ${v.name}`,
    manufacturer: { '@type': 'Organization', name: v.model.make.name },
    model: v.model.name,
    vehicleModelDate: productionEnd,
    productionDate: `${v.yearFrom}/${productionEnd}`,
    ...(v.gvmKg != null
      ? {
          weightTotal: {
            '@type': 'QuantitativeValue',
            value: v.gvmKg,
            unitCode: 'KGM',
          },
        }
      : {}),
  };
}

function buildHowToJsonLd(data: TouringRigPageData): object {
  const { variant: v } = data;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const headroom = gvmHeadroom(v);

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to set up a ${makeName} ${modelName} ${v.name} as a touring rig`,
    description: `Step-by-step guide to building a touring rig with the ${makeName} ${modelName} ${v.name}, including GVM headroom (${formatKg(headroom)}), common accessories, and GVM upgrade paths.`,
    step: [
      {
        '@type': 'HowToStep',
        name: 'Know your GVM headroom',
        text: `The ${makeName} ${modelName} ${v.name} has a GVM of ${formatKg(v.gvmKg)} and a kerb weight of ${formatKg(v.kerbWeightKg)}, giving ${formatKg(headroom)} of available load capacity before you hit the GVM limit.`,
      },
      {
        '@type': 'HowToStep',
        name: 'Budget your accessory weight',
        text: 'Add up the installed weight of your planned accessories against your available GVM headroom. Front-heavy accessories (bull bars, winches) affect front axle limits first.',
      },
      {
        '@type': 'HowToStep',
        name: 'Consider a GVM upgrade if needed',
        text: `If your planned touring build exceeds the stock GVM of ${formatKg(v.gvmKg)}, a certified GVM upgrade kit can increase your legal payload capacity. Always use a certified provider.`,
      },
      {
        '@type': 'HowToStep',
        name: 'Verify your rig with the calculator',
        text: `Use the TravellingBuddy calculator with your exact accessory list to confirm you are within GVM, axle limits, and GCM before you leave.`,
      },
    ],
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vehicle } = await params;
  const data = await getTouringRigPageData(vehicle);
  if (!data) return { title: 'Not Found' };

  const { variant: v } = data;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const rangeLabel = yearRangeLabel(v);
  const headroom = gvmHeadroom(v);

  const title = `${makeName} ${modelName} ${v.name} Touring Rig — GVM & Setup Guide`;
  const description =
    `${makeName} ${modelName} ${v.name} (${rangeLabel}) touring rig setup guide. ` +
    `GVM ${formatKg(v.gvmKg)}, kerb weight ${formatKg(v.kerbWeightKg)}, ` +
    `GVM headroom ${formatKg(headroom)}. ` +
    `Covers common accessories, GVM upgrade paths, and load budgeting for 4WD tourers and van lifers.`;

  const canonicalUrl = `/touring-setups/${vehicle}/`;

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function OverviewSection({ v }: { v: TouringRigVariant }) {
  const headroom = gvmHeadroom(v);
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">
        Load capacity overview
      </h2>
      <p className="text-sm text-gray-600">
        GVM headroom is how much payload you can add before hitting your
        vehicle&apos;s legal gross vehicle mass — passengers, fuel, accessories,
        and cargo included.
      </p>
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-1">
        <SpecRow label="GVM (gross vehicle mass)" value={formatKg(v.gvmKg)} />
        <SpecRow label="Kerb weight" value={formatKg(v.kerbWeightKg)} />
        <SpecRow
          label="GVM headroom (available payload)"
          value={formatKg(headroom)}
        />
        <SpecRow
          label="GCM (gross combination mass)"
          value={formatKg(v.gcmKg)}
        />
        <SpecRow
          label="Front axle limit"
          value={formatKg(v.frontAxleLimitKg)}
        />
        <SpecRow label="Rear axle limit" value={formatKg(v.rearAxleLimitKg)} />
      </div>
      {headroom != null && (
        <p className="text-xs text-gray-500">
          This is a {gvmClass(v.gvmKg)} vehicle. Stock GVM headroom of{' '}
          <strong>{headroom.toLocaleString()} kg</strong> must cover all
          passengers, fuel, accessories, water, food, and camping gear.
        </p>
      )}
    </section>
  );
}

function AccessoryCard({ acc }: { acc: TouringAccessoryRow }) {
  return (
    <Link
      href={`/accessories/${acc.brandSlug}/${acc.slug}/`}
      className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 text-sm transition-colors hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="font-medium text-gray-900">{acc.name}</span>
      <span className="text-xs text-gray-500">{acc.brandName}</span>
      <span className="text-xs text-gray-400">
        {acc.categoryName} · {acc.installedWeightKg.toFixed(1)} kg installed
      </span>
    </Link>
  );
}

function AccessoriesSection({
  accessories,
  vehicleName,
}: {
  accessories: TouringAccessoryRow[];
  vehicleName: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">
        Common touring accessories
      </h2>
      <p className="text-sm text-gray-600">
        Accessories commonly fitted to the {vehicleName}. Each link shows
        installed weight and fitment details so you can budget your GVM load
        accurately.
      </p>
      {accessories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          No accessory fitment data yet for this variant.{' '}
          <Link href="/submit" className="text-blue-600 hover:underline">
            Submit a fitment
          </Link>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accessories.map((acc) => (
            <AccessoryCard key={acc.id} acc={acc} />
          ))}
        </div>
      )}
    </section>
  );
}

function GvmUpgradeSection({
  gvmUpgrades,
  v,
}: {
  gvmUpgrades: TouringAccessoryRow[];
  v: TouringRigVariant;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">GVM upgrade paths</h2>
      <p className="text-sm text-gray-600">
        If your touring build exceeds the stock GVM of {formatKg(v.gvmKg)}, a
        certified GVM upgrade kit increases your legal payload capacity. GVM
        upgrades require engineer certification and change your registration —
        always use a certified provider.
      </p>
      {gvmUpgrades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">
            No GVM upgrade kits are currently listed for this variant.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            GVM upgrades are available from specialist suspension and
            engineering shops. Confirm certification with an authorised repairer
            before purchasing.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {gvmUpgrades.map((acc) => (
            <AccessoryCard key={acc.id} acc={acc} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TouringRigPage({ params }: Props) {
  const { vehicle } = await params;
  const data = await getTouringRigPageData(vehicle);
  if (!data) notFound();

  const { variant: v } = data;
  const makeName = v.model.make.name;
  const modelName = v.model.name;
  const rangeLabel = yearRangeLabel(v);
  const fullName = `${makeName} ${modelName} ${v.name}`;

  const vehicleProfileHref = `/vehicles/${v.model.make.slug}/${v.model.slug}/${v.slug}/`;
  const calculatorHref = `/calculator?v=${v.slug}`;

  const vehicleJsonLd = buildVehicleJsonLd(data);
  const howToJsonLd = buildHowToJsonLd(data);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500">
          <Link href="/vehicles" className="hover:text-blue-700">
            Vehicles
          </Link>
          <span>/</span>
          <Link href={vehicleProfileHref} className="hover:text-blue-700">
            {makeName} {modelName}
          </Link>
          <span>/</span>
          <span className="text-gray-900">Touring setup</span>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {fullName} Touring Setup Guide
        </h1>

        {/* Subtitle / year range */}
        <p className="mt-2 text-base text-gray-500">{rangeLabel}</p>

        {/* Lead paragraph */}
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          This guide covers the {fullName} ({rangeLabel}) as a solo touring rig
          — no caravan, no trailer. It focuses on available GVM headroom, common
          touring accessories and their weight impact, and GVM upgrade paths for
          builders who need more payload.
        </p>

        {/* Calculator CTA */}
        <div className="mt-6">
          <Link
            href={calculatorHref}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Build your rig load →
          </Link>
        </div>

        {/* Overview — key specs */}
        <div className="mt-10">
          <OverviewSection v={v} />
        </div>

        {/* Common accessories */}
        <div className="mt-10">
          <AccessoriesSection
            accessories={data.accessories}
            vehicleName={fullName}
          />
        </div>

        {/* GVM upgrade paths */}
        <div className="mt-10">
          <GvmUpgradeSection gvmUpgrades={data.gvmUpgradeAccessories} v={v} />
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
            {v.maxTowingCapacityKg != null && (
              <Link
                href={`/calculator?v=${v.slug}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
              >
                <span className="font-medium">{fullName} + caravan combos</span>
                <span className="text-xs text-gray-400">
                  Tows up to {formatKg(v.maxTowingCapacityKg)}
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-sm font-medium text-blue-900">
            Know your exact load before you leave
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Enter your accessories, passengers, fuel, water, and cargo into the
            TravellingBuddy calculator to verify you are within GVM and axle
            limits.
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
