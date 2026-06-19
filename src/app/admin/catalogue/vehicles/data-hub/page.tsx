import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { AdminPageHeader } from '@/modules/admin/components/AdminPageHeader';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Vehicle Data Hub — Admin' };

const PAGE_SIZE = 50;
const CATEGORIES = ['MA', 'MB', 'MC', 'MD', 'ME', 'NA', 'NB1', 'NB2', 'NC'];
const STATES = ['UNFETCHED', 'EXPANDED', 'SKIPPED'] as const;

type Search = {
  q?: string;
  category?: string;
  state?: string;
  page?: string;
};

export default async function DataHubPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const category = sp.category ?? '';
  const state = sp.state ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: Prisma.RoverApprovalIndexWhereInput = {};
  if (q) {
    where.OR = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { vtaNumber: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;
  if (state)
    where.expandState =
      state as Prisma.RoverApprovalIndexWhereInput['expandState'];

  const [rows, total, totalAll] = await Promise.all([
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
        lastUpdated: true,
        expandState: true,
      },
    }),
    prisma.roverApprovalIndex.count({ where }),
    prisma.roverApprovalIndex.count(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkTo = (overrides: Partial<Search>) => {
    const merged: Search = {
      q,
      category,
      state,
      page: String(page),
      ...overrides,
    };
    const p = new URLSearchParams();
    if (merged.q) p.set('q', merged.q);
    if (merged.category) p.set('category', merged.category);
    if (merged.state) p.set('state', merged.state);
    if (merged.page && merged.page !== '1') p.set('page', merged.page);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <div>
      <AdminPageHeader
        title="Vehicle Data Hub"
        description={`ROVER skeleton index — every 2021+ approval (M/N): cars, vans, utes, trucks, buses. Names-first; UNFETCHED rows expand (RVD fetch, via the VPN) on selection. ${totalAll.toLocaleString()} vehicles indexed.`}
      />

      {/* Filters (server-rendered GET form) */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <label className="flex flex-col text-xs font-medium text-gray-600">
          Search make / model / VTA
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="e.g. Hilux, Sprinter, VTA-0472…"
            className="mt-1 w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-gray-600">
          Category
          <select
            name="category"
            defaultValue={category}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-medium text-gray-600">
          State
          <select
            name="state"
            defaultValue={state}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
          >
            <option value="">All</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Search
        </button>
        {(q || category || state) && (
          <Link
            href="/admin/catalogue/vehicles/data-hub"
            className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      <p className="mb-2 text-sm text-gray-500">
        {total.toLocaleString()} match{total === 1 ? '' : 'es'}
        {total > 0 && ` · page ${page} of ${pages}`}
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">VTA</th>
              <th className="px-4 py-2">Make</th>
              <th className="px-4 py-2">Model</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Last updated</th>
              <th className="px-4 py-2">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No vehicles match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-600">
                  {r.vtaNumber}
                </td>
                <td className="px-4 py-2 text-gray-900">{r.make ?? '—'}</td>
                <td className="px-4 py-2 text-gray-900">{r.model ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                    {r.category ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {r.lastUpdated
                    ? r.lastUpdated.toISOString().slice(0, 10)
                    : '—'}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    {r.expandState}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={linkTo({ page: String(page - 1) })}
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
            href={linkTo({ page: String(page + 1) })}
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
