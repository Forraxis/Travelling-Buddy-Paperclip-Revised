import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { prisma } from '@/lib/db';
import { ExpandButton } from '../_components/ExpandButton';

export const metadata = { title: 'Vehicle — Data Hub' };

// The ROVER figures the RVD carries per variant (candidate field keys → labels).
const FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'gvmKg', label: 'GVM', unit: 'kg' },
  { key: 'gcmKg', label: 'GCM', unit: 'kg' },
  { key: 'maxTowingCapacityKg', label: 'Braked tow', unit: 'kg' },
  { key: 'kerbWeightKg', label: 'Kerb', unit: 'kg' },
  { key: 'wheelbaseMm', label: 'Wheelbase', unit: 'mm' },
  { key: 'totalLengthMm', label: 'Length', unit: 'mm' },
];

export default async function VtaDetailPage({
  params,
}: {
  params: Promise<{ vta: string }>;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const vta = decodeURIComponent((await params).vta);
  const row = await prisma.roverApprovalIndex.findUnique({
    where: { vtaNumber: vta },
  });
  if (!row) notFound();

  const [candidates, docs] = await Promise.all([
    prisma.vehicleSpecCandidate.findMany({
      where: { sourceVtaNumber: vta },
      include: {
        fields: true,
        resultingVariant: { select: { id: true, name: true } },
      },
      orderBy: { variantName: 'asc' },
    }),
    prisma.roverDocument.findMany({
      where: { vtaNumber: vta },
      select: {
        docType: true,
        generatedDate: true,
        categoryFine: true,
        variantCount: true,
        validFrom: true,
        expiresOn: true,
        importedAt: true,
      },
      orderBy: { importedAt: 'desc' },
    }),
  ]);

  const fieldVal = (
    fields: {
      field: string;
      value: string | null;
      adminValue: string | null;
    }[],
    key: string,
  ) => {
    const f = fields.find((x) => x.field === key);
    return f ? (f.adminValue ?? f.value) : null;
  };

  const title = row.baseMake
    ? `${row.baseMake} ${row.baseModel ?? ''}`.trim()
    : (row.make ?? row.vtaNumber);

  return (
    <div>
      <AdminPageHeader
        title={title}
        description={`${vta} · ${row.category ?? '—'}${row.isSecondStage ? ' · second-stage modification' : ''}`}
        actions={
          row.expandState === 'UNFETCHED' && row.approvalId ? (
            <ExpandButton approvalId={row.approvalId} vtaNumber={vta} />
          ) : undefined
        }
      />

      {/* Identity card */}
      <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg border border-gray-200 bg-white p-4 text-sm md:grid-cols-4">
        <Field label="Base make" value={row.baseMake} />
        <Field label="Base model" value={row.baseModel} />
        <Field
          label="Modifier"
          value={
            row.modifier
              ? `${row.modifier}${row.isSecondStage ? ' (2nd-stage)' : ''}`
              : '—'
          }
        />
        <Field label="Category" value={row.category} />
        <Field
          label="Raw (ROVER)"
          value={`${row.make ?? ''} ${row.model ?? ''}`}
        />
        <Field label="Normalization" value={row.normalizationStatus} />
        <Field label="State" value={row.expandState} />
        <Field
          label="Last updated"
          value={
            row.lastUpdated ? row.lastUpdated.toISOString().slice(0, 10) : '—'
          }
        />
      </div>

      {/* Per-variant ROVER figures */}
      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        Variants &amp; figures{' '}
        <span className="font-normal text-gray-400">
          ({candidates.length} candidate{candidates.length === 1 ? '' : 's'})
        </span>
      </h2>
      {candidates.length === 0 ? (
        <p className="mb-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {row.expandState === 'UNFETCHED'
            ? 'Not fetched yet — click Expand (top right) to pull this vehicle’s RVD data.'
            : 'No candidates found for this VTA.'}
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2">Variant</th>
                {FIELDS.map((f) => (
                  <th key={f.key} className="px-4 py-2 text-right">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">
                    {c.variantName ?? '—'}
                  </td>
                  {FIELDS.map((f) => {
                    const v = fieldVal(c.fields, f.key);
                    return (
                      <td
                        key={f.key}
                        className="px-4 py-2 text-right text-gray-700 tabular-nums"
                      >
                        {v ? `${Number(v).toLocaleString('en-AU')}` : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                      {c.status}
                    </span>
                    {c.resultingVariant && (
                      <Link
                        href={`/admin/catalogue/vehicles/data-hub/variant/${c.resultingVariant.id}`}
                        className="hover:text-tb-primary ml-2 text-xs text-gray-500"
                      >
                        coverage →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived documents */}
      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        Archived documents{' '}
        <span className="font-normal text-gray-400">({docs.length})</span>
      </h2>
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400">None archived yet.</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-600">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                {d.docType}
              </span>
              <span>
                {d.generatedDate ?? d.validFrom ?? '—'}
                {d.categoryFine ? ` · ${d.categoryFine}` : ''}
                {d.variantCount ? ` · ${d.variantCount} variants` : ''}
              </span>
              <span className="text-xs text-gray-400">
                imported {d.importedAt.toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link
          href="/admin/catalogue/vehicles/data-hub"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Data Hub
        </Link>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-gray-900">{value || '—'}</div>
    </div>
  );
}
