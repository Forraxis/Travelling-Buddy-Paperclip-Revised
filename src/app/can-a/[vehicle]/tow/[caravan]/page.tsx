import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getComboPageData,
  getAllComboSlugsForSSG,
  buildComboSlug,
} from '@/modules/catalogue/queries/combo.queries';
import type {
  ComboPageData,
  ComboVariantMini,
} from '@/modules/catalogue/queries/combo.queries';
import type { VehicleVariantDto } from '@/modules/catalogue/types/vehicle.types';
import type { CaravanVariantDto } from '@/modules/catalogue/types/caravan.types';

export const revalidate = 86400;

// ── Params ───────────────────────────────────────────────────────────────────

interface PageParams {
  vehicle: string;
  caravan: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllComboSlugsForSSG();
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function yearRangeLabel(v: {
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
}): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  if (v.yearFrom === v.yearTo) return `${v.yearFrom}`;
  return `${v.yearFrom}–${v.yearTo}`;
}

function coverageYears(v: { yearFrom: number; yearTo: number }): number[] {
  return Array.from(
    { length: v.yearTo - v.yearFrom + 1 },
    (_, i) => v.yearFrom + i,
  );
}

function enumerateYearsProse(years: number[]): string {
  if (years.length === 0) return '';
  if (years.length === 1) return `${years[0]}`;
  const init = years.slice(0, -1).join(', ');
  return `${init}, or ${years[years.length - 1]}`;
}

function formatKg(n: number | null | undefined): string {
  return n != null ? `${n.toLocaleString()} kg` : '—';
}

function formatPct(n: number | null | undefined): string {
  return n != null ? `${Math.round(n)}%` : '—';
}

// ── Combo metrics computation ────────────────────────────────────────────────

type MetricStatus = 'ok' | 'warn' | 'fail' | 'info';
type Verdict = 'pass' | 'warn' | 'fail';

interface ComboMetric {
  label: string;
  valueKg: number | null;
  limitKg: number | null;
  pct: number | null;
  status: MetricStatus;
  note?: string;
}

interface ComboMetrics {
  verdict: Verdict;
  verdictReason: string;
  metrics: ComboMetric[];
}

const FUEL_DENSITY: Record<string, number> = {
  DIESEL: 0.84,
  PETROL: 0.73,
  HYBRID: 0.73,
  ELECTRIC: 0,
};

function metricStatus(value: number, limit: number): MetricStatus {
  if (value > limit) return 'fail';
  if (value > limit * 0.9) return 'warn';
  return 'ok';
}

function computeComboMetrics(
  v: VehicleVariantDto,
  c: CaravanVariantDto,
): ComboMetrics {
  const fuelDensity = v.fuelType ? (FUEL_DENSITY[v.fuelType] ?? 0.73) : 0.73;
  const fuelMassKg =
    v.fuelTankCapacityL != null ? v.fuelTankCapacityL * fuelDensity : null;

  // Standard load: 2 passengers (80 kg each) + full fuel
  const stdPassengerKg = 160;
  const vehicleStdBaseKg =
    v.kerbWeightKg != null && fuelMassKg != null
      ? v.kerbWeightKg + fuelMassKg + stdPassengerKg
      : null;

  const tbm = c.tbmKg ?? null;
  const atm = c.atmKg ?? null;
  const gtm = c.gtmKg ?? null;
  const maxTow = v.maxTowingCapacityKg ?? null;
  const maxTbd = v.maxTowBallDownloadKg ?? null;
  const gvmLimit = v.gvmKg ?? null;
  const gcmLimit = v.gcmKg ?? null;
  const frontLimit = v.frontAxleLimitKg ?? null;
  const rearLimit = v.rearAxleLimitKg ?? null;

  // Vehicle GVM at standard load + TBM
  const gvmActual =
    vehicleStdBaseKg != null && tbm != null
      ? vehicleStdBaseKg + tbm
      : vehicleStdBaseKg != null
        ? vehicleStdBaseKg
        : null;

  // GCM: vehicle at standard load + caravan at ATM
  const gcmActual = gvmActual != null && atm != null ? gvmActual + atm : null;

  // Axle loads — simplified proportion when wheelbase is available
  // Front CoG ≈ 0.45 × wheelbase from rear; rear picks up TBM at rearOverhang
  let frontAxleKg: number | null = null;
  let rearAxleKg: number | null = null;
  if (gvmActual != null && v.wheelbaseMm != null && v.wheelbaseMm > 0) {
    const rearOverhang = v.rearOverhangMm ?? 400;
    // Vehicle CoG fraction at ~0.55 from front axle  = 0.45 from rear
    const vehicleMoment = (vehicleStdBaseKg ?? 0) * (v.wheelbaseMm * 0.45);
    const tbmMoment = (tbm ?? 0) * -rearOverhang;
    const frontCalc = (vehicleMoment + tbmMoment) / v.wheelbaseMm;
    frontAxleKg = Math.max(0, frontCalc);
    rearAxleKg = Math.max(0, gvmActual - frontAxleKg);
  }

  // Derived
  const tbmPctOfAtm =
    tbm != null && atm != null && atm > 0 ? (tbm / atm) * 100 : null;
  const towUtilPct =
    atm != null && maxTow != null && maxTow > 0 ? (atm / maxTow) * 100 : null;

  // Build metric array — 10 total
  const metrics: ComboMetric[] = [
    // 1. Tow capacity
    {
      label: 'Tow capacity vs caravan ATM',
      valueKg: atm,
      limitKg: maxTow,
      pct: towUtilPct,
      status:
        atm != null && maxTow != null ? metricStatus(atm, maxTow) : 'info',
    },
    // 2. Tow ball download
    {
      label: 'Tow ball download vs limit',
      valueKg: tbm,
      limitKg: maxTbd,
      pct:
        tbm != null && maxTbd != null && maxTbd > 0
          ? (tbm / maxTbd) * 100
          : null,
      status:
        tbm != null && maxTbd != null ? metricStatus(tbm, maxTbd) : 'info',
    },
    // 3. GCM
    {
      label: 'Gross combination mass (GCM)',
      valueKg: gcmActual,
      limitKg: gcmLimit,
      pct:
        gcmActual != null && gcmLimit != null && gcmLimit > 0
          ? (gcmActual / gcmLimit) * 100
          : null,
      status:
        gcmActual != null && gcmLimit != null
          ? metricStatus(gcmActual, gcmLimit)
          : 'info',
      note: 'Vehicle at standard load + caravan at ATM',
    },
    // 4. GVM at standard load
    {
      label: 'Gross vehicle mass (GVM)',
      valueKg: gvmActual,
      limitKg: gvmLimit,
      pct:
        gvmActual != null && gvmLimit != null && gvmLimit > 0
          ? (gvmActual / gvmLimit) * 100
          : null,
      status:
        gvmActual != null && gvmLimit != null
          ? metricStatus(gvmActual, gvmLimit)
          : 'info',
      note: 'Vehicle at kerb + 2 passengers + full fuel + TBM',
    },
    // 5. Front axle
    {
      label: 'Front axle load',
      valueKg: frontAxleKg,
      limitKg: frontLimit,
      pct:
        frontAxleKg != null && frontLimit != null && frontLimit > 0
          ? (frontAxleKg / frontLimit) * 100
          : null,
      status:
        frontAxleKg != null && frontLimit != null
          ? metricStatus(frontAxleKg, frontLimit)
          : 'info',
      note:
        frontAxleKg == null ? 'Requires calculator for exact value' : undefined,
    },
    // 6. Rear axle
    {
      label: 'Rear axle load',
      valueKg: rearAxleKg,
      limitKg: rearLimit,
      pct:
        rearAxleKg != null && rearLimit != null && rearLimit > 0
          ? (rearAxleKg / rearLimit) * 100
          : null,
      status:
        rearAxleKg != null && rearLimit != null
          ? metricStatus(rearAxleKg, rearLimit)
          : 'info',
      note:
        rearAxleKg == null ? 'Requires calculator for exact value' : undefined,
    },
    // 7. Caravan ATM rating
    {
      label: 'Caravan ATM (rated)',
      valueKg: atm,
      limitKg: null,
      pct: null,
      status: 'info',
    },
    // 8. Caravan GTM rating
    {
      label: 'Caravan GTM (rated)',
      valueKg: gtm,
      limitKg: null,
      pct: null,
      status: 'info',
    },
    // 9. TBM % of ATM (ADR: ≤ 10%)
    {
      label: 'Tow ball mass as % of ATM',
      valueKg: tbm,
      limitKg: atm != null ? atm * 0.1 : null,
      pct: tbmPctOfAtm,
      status: tbmPctOfAtm != null ? (tbmPctOfAtm > 10 ? 'warn' : 'ok') : 'info',
      note: 'ADR guideline: TBM ≤ 10% of ATM',
    },
    // 10. Towing utilization %
    {
      label: 'Towing capacity utilization',
      valueKg: atm,
      limitKg: maxTow,
      pct: towUtilPct,
      status:
        towUtilPct != null
          ? towUtilPct > 100
            ? 'fail'
            : towUtilPct > 90
              ? 'warn'
              : 'ok'
          : 'info',
    },
  ];

  // Overall verdict — based on the hard compliance checks
  const complianceStatuses = metrics
    .slice(0, 4)
    .map((m) => m.status)
    .filter((s): s is 'ok' | 'warn' | 'fail' => s !== 'info');

  let verdict: Verdict = 'pass';
  let verdictReason =
    'This combination is legal under standard load conditions.';

  if (complianceStatuses.includes('fail')) {
    verdict = 'fail';
    if (atm != null && maxTow != null && atm > maxTow) {
      verdictReason = `The caravan ATM (${formatKg(atm)}) exceeds the vehicle's maximum towing capacity (${formatKg(maxTow)}).`;
    } else if (tbm != null && maxTbd != null && tbm > maxTbd) {
      verdictReason = `The caravan TBM (${formatKg(tbm)}) exceeds the vehicle's tow ball download limit (${formatKg(maxTbd)}).`;
    } else if (gcmActual != null && gcmLimit != null && gcmActual > gcmLimit) {
      verdictReason = `The combination mass (${formatKg(gcmActual)}) exceeds the vehicle's GCM limit (${formatKg(gcmLimit)}).`;
    } else {
      verdictReason =
        'One or more limits are exceeded under standard load conditions.';
    }
  } else if (complianceStatuses.includes('warn')) {
    verdict = 'warn';
    verdictReason =
      'This combination is within legal limits but close to the boundary — use the calculator to verify with your exact load.';
  }

  return { verdict, verdictReason, metrics };
}

// ── FAQ builder ──────────────────────────────────────────────────────────────

interface FaqEntry {
  question: string;
  answer: string;
}

type VerdictAspect = 'headline' | 'tow-capacity' | 'atm' | 'gcm' | 'tbm';

function buildComboFaqs(
  vMakeName: string,
  vModelName: string,
  vVariantName: string,
  v: VehicleVariantDto,
  cMakeName: string,
  cModelName: string,
  cVariantName: string,
  c: CaravanVariantDto,
  comboMetrics: ComboMetrics,
): FaqEntry[] {
  const vFull = `${vMakeName} ${vModelName} ${vVariantName}`;
  const cFull = `${cMakeName} ${cModelName} ${cVariantName}`;
  const vYears = coverageYears(v);
  const cYears = coverageYears(c);

  const verdictWord =
    comboMetrics.verdict === 'fail' ? 'not recommended' : 'legal';

  const makeEntry = (
    yearV: number,
    yearC: number,
    aspect: VerdictAspect,
  ): FaqEntry | null => {
    switch (aspect) {
      case 'headline':
        return {
          question: `Can a ${yearV} ${vFull} tow a ${yearC} ${cFull}?`,
          answer:
            comboMetrics.verdict === 'fail'
              ? `The ${yearV} ${vFull} is generally not recommended to tow a ${yearC} ${cFull}. ${comboMetrics.verdictReason}`
              : `Yes, the ${yearV} ${vFull} can tow a ${yearC} ${cFull}. ${comboMetrics.verdictReason} Always verify with the TravellingBuddy calculator using your exact load.`,
        };
      case 'tow-capacity':
        if (v.maxTowingCapacityKg == null) return null;
        return {
          question: `What is the maximum towing capacity of the ${yearV} ${vFull}?`,
          answer: `The ${yearV} ${vFull} has a rated maximum towing capacity of ${formatKg(v.maxTowingCapacityKg)}. The ${yearC} ${cFull} has an ATM of ${formatKg(c.atmKg)}, which is ${verdictWord} for this vehicle.`,
        };
      case 'atm':
        if (c.atmKg == null) return null;
        return {
          question: `What is the ATM of the ${yearC} ${cFull}?`,
          answer: `The ${yearC} ${cFull} has an aggregate trailer mass (ATM) of ${formatKg(c.atmKg)}. The ${yearV} ${vFull} has a maximum towing capacity of ${formatKg(v.maxTowingCapacityKg)}, making this combination ${verdictWord}.`,
        };
      case 'gcm':
        if (v.gcmKg == null || c.atmKg == null || v.gvmKg == null) return null;
        return {
          question: `Does the ${yearV} ${vFull} comply with GCM when towing a ${yearC} ${cFull}?`,
          answer: `The ${yearV} ${vFull} has a GCM limit of ${formatKg(v.gcmKg)}. At the vehicle's GVM (${formatKg(v.gvmKg)}) plus the caravan at ATM (${formatKg(c.atmKg)}), the combination mass is ${formatKg((v.gvmKg ?? 0) + (c.atmKg ?? 0))}, which is ${(v.gvmKg ?? 0) + (c.atmKg ?? 0) <= v.gcmKg ? 'within' : 'over'} the GCM limit.`,
        };
      case 'tbm':
        if (c.tbmKg == null) return null;
        return {
          question: `What is the tow ball mass of the ${yearC} ${cFull}?`,
          answer: `The ${yearC} ${cFull} has a rated tow ball mass (TBM) of ${formatKg(c.tbmKg)}. The ${yearV} ${vFull} has a maximum tow ball download limit of ${formatKg(v.maxTowBallDownloadKg)}, so this is ${c.tbmKg <= (v.maxTowBallDownloadKg ?? Infinity) ? 'within spec' : 'over the limit'}.`,
        };
    }
  };

  const ASPECTS: VerdictAspect[] = [
    'headline',
    'tow-capacity',
    'atm',
    'gcm',
    'tbm',
  ];

  const entries: FaqEntry[] = [];
  const vMostRecent = vYears[vYears.length - 1];
  const cMostRecent = cYears[cYears.length - 1];

  // Priority 1: (mostRecentV × mostRecentC) × each aspect
  for (const aspect of ASPECTS) {
    if (entries.length >= 15) break;
    const e = makeEntry(vMostRecent, cMostRecent, aspect);
    if (e) entries.push(e);
  }

  // Priority 2: (mostRecentV × each earlier C year) × headline
  for (let i = cYears.length - 2; i >= 0; i--) {
    if (entries.length >= 15) break;
    const e = makeEntry(vMostRecent, cYears[i], 'headline');
    if (e) entries.push(e);
  }

  // Priority 3: (each earlier V year × mostRecentC) × headline
  for (let i = vYears.length - 2; i >= 0; i--) {
    if (entries.length >= 15) break;
    const e = makeEntry(vYears[i], cMostRecent, 'headline');
    if (e) entries.push(e);
  }

  // Priority 4: remaining year-pair cross product × headline
  outer: for (let vi = vYears.length - 2; vi >= 0; vi--) {
    for (let ci = cYears.length - 2; ci >= 0; ci--) {
      if (entries.length >= 15) break outer;
      const e = makeEntry(vYears[vi], cYears[ci], 'headline');
      if (e) entries.push(e);
    }
  }

  return entries;
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────

function buildVehicleJsonLd(data: ComboPageData): object {
  const v = data.vehicle;
  const make = v.model.make;
  const model = v.model;
  const productionEnd = v.isCurrentProduction
    ? new Date().getFullYear().toString()
    : v.yearTo.toString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${make.name} ${model.name} ${v.name}`,
    manufacturer: { '@type': 'Organization', name: make.name },
    model: model.name,
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
    ...(v.maxTowingCapacityKg != null
      ? {
          towingCapacity: {
            '@type': 'QuantitativeValue',
            value: v.maxTowingCapacityKg,
            unitCode: 'KGM',
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

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vehicle, caravan } = await params;
  const data = await getComboPageData(vehicle, caravan);
  if (!data) return { title: 'Not Found' };

  const v = data.vehicle;
  const c = data.caravan;
  const vMake = v.model.make.name;
  const vModel = v.model.name;
  const cMake = c.model.make.name;
  const cModel = c.model.name;
  const vRange = yearRangeLabel(v);
  const cRange = yearRangeLabel(c);

  const title = `Can a ${vMake} ${vModel} ${v.name} (${vRange}) tow a ${cMake} ${cModel} ${c.name} (${cRange})?`;
  const description = `Full compliance check: GVM, GCM, tow ball, axle loads, ATM, GTM, and TBM analysis for the ${vMake} ${vModel} ${v.name} towing a ${cMake} ${cModel} ${c.name}. Australian market data.`;
  const canonicalUrl = `/can-a/${vehicle}/tow/${caravan}/`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      images: [{ url: '/og/combo-default.png', width: 1200, height: 630 }],
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === 'pass') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Legal combination
      </span>
    );
  }
  if (verdict === 'warn') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        Near limit — verify load
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      Not recommended
    </span>
  );
}

function MetricBar({ metric }: { metric: ComboMetric }) {
  const barColors: Record<MetricStatus, string> = {
    ok: 'bg-green-500',
    warn: 'bg-amber-400',
    fail: 'bg-red-500',
    info: 'bg-blue-400',
  };
  const borderColors: Record<MetricStatus, string> = {
    ok: 'border-green-200',
    warn: 'border-amber-200',
    fail: 'border-red-200',
    info: 'border-gray-200',
  };

  const pct = metric.pct != null ? Math.min(metric.pct, 100) : null;
  const barColor = barColors[metric.status];
  const borderColor = borderColors[metric.status];

  return (
    <div className={`rounded-lg border ${borderColor} bg-white p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">{metric.label}</p>
          {metric.note && (
            <p className="mt-0.5 text-xs text-gray-400">{metric.note}</p>
          )}
        </div>
        <div className="text-right text-sm">
          {metric.valueKg != null && (
            <span className="font-semibold text-gray-900">
              {metric.valueKg.toLocaleString()} kg
            </span>
          )}
          {metric.limitKg != null && (
            <span className="text-gray-400">
              {' '}
              / {metric.limitKg.toLocaleString()} kg
            </span>
          )}
          {metric.valueKg == null && <span className="text-gray-400">—</span>}
          {metric.pct != null && (
            <p className="mt-0.5 text-xs text-gray-500">
              {formatPct(metric.pct)}
            </p>
          )}
        </div>
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FaqSection({ faqs }: { faqs: FaqEntry[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
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

function AlternativesList({
  title,
  items,
  hrefBuilder,
  vehicleSlug,
  caravanSlug,
}: {
  title: string;
  items: ComboVariantMini[];
  hrefBuilder: (item: ComboVariantMini) => string;
  vehicleSlug: string;
  caravanSlug: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={hrefBuilder(item)}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-blue-700"
          >
            <span className="font-medium">
              {item.makeName} {item.modelName} {item.name}
            </span>
            <span className="text-xs text-gray-400">
              {yearRangeLabel(item)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComboPage({ params }: Props) {
  const { vehicle: vehicleSlug, caravan: caravanSlug } = await params;
  const data = await getComboPageData(vehicleSlug, caravanSlug);
  if (!data) notFound();

  const { vehicle: v, caravan: c } = data;

  const vMake = v.model.make;
  const vModel = v.model;
  const cMake = c.model.make;
  const cModel = c.model;

  const vYears = coverageYears(v);
  const cYears = coverageYears(c);
  const vRange = yearRangeLabel(v);
  const cRange = yearRangeLabel(c);

  const comboMetrics = computeComboMetrics(v, c);
  const faqs = buildComboFaqs(
    vMake.name,
    vModel.name,
    v.name,
    v,
    cMake.name,
    cModel.name,
    c.name,
    c,
    comboMetrics,
  );

  const vehicleJsonLd = buildVehicleJsonLd(data);
  const faqJsonLd = buildFaqJsonLd(faqs);

  const vehicleProfileHref = `/vehicles/${vMake.slug}/${vModel.slug}/${v.slug}/`;
  const caravanProfileHref = `/caravans/${cMake.slug}/${cModel.slug}/${c.slug}/`;
  const calculatorHref = `/calculator?v=${v.slug}&c=${c.slug}`;

  // Fragments corpus — placeholder; editorial content authored separately in phase 12.9
  // const fragments = await loadComboFragments(vehicleSlug, caravanSlug);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500">
          <Link href="/vehicles" className="hover:text-blue-700">
            Vehicles
          </Link>
          <span>/</span>
          <Link href={vehicleProfileHref} className="hover:text-blue-700">
            {vMake.name} {vModel.name} {v.name}
          </Link>
          <span>/</span>
          <span className="text-gray-900">
            vs {cMake.name} {cModel.name} {c.name}
          </span>
        </nav>

        {/* H1 */}
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Can a {vMake.name} {vModel.name} {v.name} ({vRange}) tow a{' '}
          {cMake.name} {cModel.name} {c.name} ({cRange})?
        </h1>

        {/* Hero verdict */}
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex-1">
            <VerdictBadge verdict={comboMetrics.verdict} />
            <p className="mt-3 text-sm text-gray-700">
              {comboMetrics.verdictReason}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:text-right">
            <div>
              <span className="text-gray-500">Max towing: </span>
              <span className="font-semibold text-gray-900">
                {formatKg(v.maxTowingCapacityKg)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Caravan ATM: </span>
              <span className="font-semibold text-gray-900">
                {formatKg(c.atmKg)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Caravan TBM: </span>
              <span className="font-semibold text-gray-900">
                {formatKg(c.tbmKg)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Vehicle GCM: </span>
              <span className="font-semibold text-gray-900">
                {formatKg(v.gcmKg)}
              </span>
            </div>
          </div>
        </div>

        {/* Lead paragraph — year enumeration for both sides */}
        <p className="mt-6 text-base leading-relaxed text-gray-600">
          This combination applies to a {enumerateYearsProse(vYears)}{' '}
          {vMake.name} {vModel.name} {v.name} paired with a{' '}
          {enumerateYearsProse(cYears)} {cMake.name} {cModel.name} {c.name}. All
          specifications on this page are unchanged across the full {vRange}{' '}
          production range of the vehicle and the {cRange} range of the caravan.
        </p>

        {/* Calculator CTA */}
        <div className="mt-6">
          <Link
            href={calculatorHref}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Verify with exact load →
          </Link>
        </div>

        {/* 10 Metric bars */}
        <div className="mt-10 space-y-3">
          <h2 className="text-xl font-bold text-gray-900">
            Compliance metrics
          </h2>
          <p className="text-sm text-gray-500">
            Vehicle GVM and axle loads estimated at kerb weight + 2 passengers
            (80 kg each) + full fuel + rated tow ball mass.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {comboMetrics.metrics.map((m) => (
              <MetricBar key={m.label} metric={m} />
            ))}
          </div>
        </div>

        {/* Internal profile links */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={vehicleProfileHref}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm transition-colors hover:bg-gray-50"
          >
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Vehicle profile
            </p>
            <p className="mt-1 font-medium text-gray-900">
              {vMake.name} {vModel.name} {v.name} ({vRange})
            </p>
            <p className="text-xs text-gray-500">
              GVM {formatKg(v.gvmKg)} · GCM {formatKg(v.gcmKg)} · Tows{' '}
              {formatKg(v.maxTowingCapacityKg)}
            </p>
          </Link>
          <Link
            href={caravanProfileHref}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm transition-colors hover:bg-gray-50"
          >
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Caravan profile
            </p>
            <p className="mt-1 font-medium text-gray-900">
              {cMake.name} {cModel.name} {c.name} ({cRange})
            </p>
            <p className="text-xs text-gray-500">
              ATM {formatKg(c.atmKg)} · GTM {formatKg(c.gtmKg)} · TBM{' '}
              {formatKg(c.tbmKg)}
            </p>
          </Link>
        </div>

        {/* Comparison sidebar — related combos */}
        <div className="mt-10 space-y-6">
          <h2 className="text-xl font-bold text-gray-900">
            Explore alternatives
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <AlternativesList
              title={`Other caravans the ${vMake.name} ${vModel.name} can tow`}
              items={data.altCaravans}
              vehicleSlug={vehicleSlug}
              caravanSlug={caravanSlug}
              hrefBuilder={(item) =>
                `/can-a/${vehicleSlug}/tow/${buildComboSlug(item.makeSlug, item.modelSlug, item.slug)}/`
              }
            />
            <AlternativesList
              title={`Other vehicles that can tow this ${cMake.name}`}
              items={data.altVehicles}
              vehicleSlug={vehicleSlug}
              caravanSlug={caravanSlug}
              hrefBuilder={(item) =>
                `/can-a/${buildComboSlug(item.makeSlug, item.modelSlug, item.slug)}/tow/${caravanSlug}/`
              }
            />
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <FaqSection faqs={faqs} />
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 rounded-xl border border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-sm font-medium text-blue-900">
            Get an exact compliance check for your specific load
          </p>
          <p className="mt-1 text-xs text-blue-700">
            The metrics above use standard load assumptions. Enter your exact
            passengers, cargo, water, and accessories in the TravellingBuddy
            calculator.
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
