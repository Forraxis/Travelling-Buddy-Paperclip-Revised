import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Variant Coverage Matrix — Admin' };

// ── Field tiers ──────────────────────────────────────────────────────────────
// Tier A: compliance + centre-of-gravity geometry. Most live as typed
// VehicleVariant columns *and* (ideally) a provenance row; the matrix reads the
// provenance row (source-of-truth for who/when/how-confident).
// Tier B: powertrain / efficiency. These live ONLY in VariantSpecProvenance —
// keyed by field name, no typed column on VehicleVariant.
type FieldDef = { key: string; label: string; unit: string };

const TIER_A: readonly FieldDef[] = [
  { key: 'gvmKg', label: 'GVM', unit: 'kg' },
  { key: 'gcmKg', label: 'GCM', unit: 'kg' },
  { key: 'frontAxleLimitKg', label: 'Front axle limit', unit: 'kg' },
  { key: 'rearAxleLimitKg', label: 'Rear axle limit', unit: 'kg' },
  { key: 'maxTowBallDownloadKg', label: 'Max tow-ball download', unit: 'kg' },
  { key: 'maxTowingCapacityKg', label: 'Max braked towing', unit: 'kg' },
  { key: 'kerbWeightKg', label: 'Kerb weight', unit: 'kg' },
  { key: 'wheelbaseMm', label: 'Wheelbase', unit: 'mm' },
  { key: 'frontOverhangMm', label: 'Front overhang', unit: 'mm' },
  { key: 'rearOverhangMm', label: 'Rear overhang', unit: 'mm' },
  { key: 'totalLengthMm', label: 'Total length', unit: 'mm' },
];

const TIER_B: readonly FieldDef[] = [
  { key: 'engineDisplacementCc', label: 'Engine displacement', unit: 'cc' },
  { key: 'cylinders', label: 'Cylinders', unit: '' },
  { key: 'induction', label: 'Induction', unit: '' },
  { key: 'powerKw', label: 'Power', unit: 'kW' },
  { key: 'torqueNm', label: 'Torque', unit: 'Nm' },
  { key: 'transmission', label: 'Transmission', unit: '' },
  { key: 'gears', label: 'Gears', unit: '' },
  { key: 'drivetrain', label: 'Drivetrain', unit: '' },
  { key: 'fuelType', label: 'Fuel type', unit: '' },
  {
    key: 'fuelConsumptionCombinedL100',
    label: 'Fuel use (combined)',
    unit: 'L/100km',
  },
  { key: 'co2Gkm', label: 'CO₂', unit: 'g/km' },
  { key: 'emissionsStandard', label: 'Emissions standard', unit: '' },
  { key: 'fuelTankCapacityL', label: 'Fuel tank capacity', unit: 'L' },
  { key: 'batteryKwh', label: 'Battery', unit: 'kWh' },
  { key: 'electricRangeKm', label: 'Electric range', unit: 'km' },
];

// The Tier-A subset that gates a compliance verdict (used for the summary header).
const TIER_A_CRITICAL = new Set([
  'gvmKg',
  'gcmKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'maxTowBallDownloadKg',
  'maxTowingCapacityKg',
]);

type ProvRow = {
  field: string;
  value: string | null;
  source: string;
  status: string;
  confidence: string | null;
  sourceUrl: string | null;
  asOf: Date;
};

const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

function StatusBadge({ status }: { status: string | null }) {
  const cls =
    status === 'CONFIRMED'
      ? 'bg-green-50 text-green-700'
      : status === 'ESTIMATE'
        ? 'bg-amber-50 text-amber-700'
        : status === 'DISPUTED'
          ? 'bg-red-50 text-red-700'
          : 'bg-gray-100 text-gray-500';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? 'missing'}
    </span>
  );
}

function MatrixTable({
  fields,
  byField,
}: {
  fields: readonly FieldDef[];
  byField: Map<string, ProvRow>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
          <tr>
            <th className="px-4 py-2">Field</th>
            <th className="px-4 py-2">Value</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">As of</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {fields.map((f) => {
            const row = byField.get(f.key);
            const hasValue = row && row.value != null && row.value !== '';
            return (
              <tr key={f.key} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {f.label}
                  {f.unit && (
                    <span className="ml-1 text-xs font-normal text-gray-400">
                      ({f.unit})
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-900">
                  {hasValue ? (
                    row.value
                  ) : (
                    <span className="text-gray-300">— missing</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={row ? row.status : null} />
                </td>
                <td className="px-4 py-2">
                  {row ? (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {row.source}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {row ? fmtDate(row.asOf) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function VariantCoveragePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const { id } = await params;

  const variant = await prisma.vehicleVariant.findUnique({
    where: { id },
    include: {
      model: { include: { make: true } },
      specProvenance: {
        select: {
          field: true,
          value: true,
          source: true,
          status: true,
          confidence: true,
          sourceUrl: true,
          asOf: true,
        },
      },
    },
  });

  if (!variant) notFound();

  const byField = new Map<string, ProvRow>(
    variant.specProvenance.map((p) => [p.field, p as ProvRow]),
  );

  // Summary — Tier-A criticals confirmed vs missing.
  let confirmed = 0;
  let missing = 0;
  for (const key of TIER_A_CRITICAL) {
    const row = byField.get(key);
    if (row && row.status === 'CONFIRMED') confirmed += 1;
    else if (!row || row.value == null || row.value === '') missing += 1;
  }
  const totalCritical = TIER_A_CRITICAL.size;

  const makeName = variant.model.make.name;
  const modelName = variant.model.name;
  const years =
    variant.yearFrom === variant.yearTo
      ? `${variant.yearFrom}`
      : `${variant.yearFrom}–${variant.yearTo}`;

  return (
    <div>
      <AdminPageHeader
        title={variant.name}
        description={`${makeName} ${modelName} · ${years}`}
        actions={
          <Link
            href="/admin/catalogue/vehicles/data-hub"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to hub
          </Link>
        }
      />

      {/* Summary header — Tier-A critical coverage */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <span className="font-medium text-gray-700">
          Compliance-critical coverage
        </span>
        <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          {confirmed} / {totalCritical} confirmed
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            missing > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {missing} missing
        </span>
        <span className="text-xs text-gray-400">
          (GVM, GCM, front/rear axle limits, tow-ball, braked towing)
        </span>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Tier A — Compliance &amp; centre-of-gravity geometry
        </h2>
        <MatrixTable fields={TIER_A} byField={byField} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Tier B — Powertrain &amp; efficiency
        </h2>
        <p className="mb-2 text-xs text-gray-400">
          Provenance-only fields (no typed column on VehicleVariant).
        </p>
        <MatrixTable fields={TIER_B} byField={byField} />
      </section>
    </div>
  );
}
