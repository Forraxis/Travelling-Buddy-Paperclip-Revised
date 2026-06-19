import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { prisma } from '@/lib/db';
import { ReviewRowForm } from './_components/ReviewRowForm';

export const metadata = { title: 'NEEDS_REVIEW Curation — Admin' };

const PAGE_SIZE = 50;

type Search = { page?: string };

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where = { normalizationStatus: 'NEEDS_REVIEW' as const };

  const [rows, total, makeRows] = await Promise.all([
    prisma.roverApprovalIndex.findMany({
      where,
      orderBy: [{ lastUpdated: 'desc' }, { vtaNumber: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        vtaNumber: true,
        make: true,
        model: true,
        category: true,
        baseMake: true,
        baseModel: true,
        modifier: true,
        lastUpdated: true,
      },
    }),
    prisma.roverApprovalIndex.count({ where }),
    // Canonical base makes already in use, for the datalist suggestions.
    prisma.roverApprovalIndex.findMany({
      where: { baseMake: { not: null } },
      distinct: ['baseMake'],
      orderBy: { baseMake: 'asc' },
      select: { baseMake: true },
      take: 300,
    }),
  ]);

  const makeSuggestions = makeRows
    .map((m) => m.baseMake)
    .filter((m): m is string => Boolean(m));

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (p: number) =>
    p <= 1 ? '/admin/catalogue/vehicles/data-hub/review' : `?page=${p}`;

  return (
    <div>
      <AdminPageHeader
        title="NEEDS_REVIEW Curation"
        description={`ROVER rows the normalizer couldn't disambiguate. Set the base make/model by hand — saving marks the row MANUAL so it leaves the queue and is never auto-overwritten. ${total.toLocaleString()} awaiting review.`}
        actions={
          <Link
            href="/admin/catalogue/vehicles/data-hub"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to Data Hub
          </Link>
        }
      />

      <p className="mb-2 text-sm text-gray-500">
        {total.toLocaleString()} row{total === 1 ? '' : 's'}
        {total > 0 && ` · page ${page} of ${pages}`}
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">VTA</th>
              <th className="px-4 py-2">Raw (ROVER)</th>
              <th className="px-4 py-2">Cat</th>
              <th className="px-4 py-2">Last updated</th>
              <th className="px-4 py-2">Resolve base identity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nothing to review — the queue is clear.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/admin/catalogue/vehicles/data-hub/${encodeURIComponent(
                      r.vtaNumber,
                    )}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {r.vtaNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.make ?? '—'} {r.model ?? ''}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {r.category ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {r.lastUpdated
                    ? r.lastUpdated.toISOString().slice(0, 10)
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <ReviewRowForm
                    id={r.id}
                    defaultBaseMake={r.baseMake ?? ''}
                    defaultBaseModel={r.baseModel ?? ''}
                    defaultModifier={r.modifier ?? ''}
                    makeSuggestions={makeSuggestions}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={pageLink(page - 1)}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? 'pointer-events-none text-gray-300'
                : 'text-gray-700 hover:text-gray-900'
            }
          >
            ← Previous
          </Link>
          <span className="text-gray-500">
            Page {page} of {pages}
          </span>
          <Link
            href={pageLink(page + 1)}
            aria-disabled={page >= pages}
            className={
              page >= pages
                ? 'pointer-events-none text-gray-300'
                : 'text-gray-700 hover:text-gray-900'
            }
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
