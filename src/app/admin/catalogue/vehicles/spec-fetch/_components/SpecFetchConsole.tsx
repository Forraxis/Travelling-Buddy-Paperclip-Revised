'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchCandidate } from '../actions';

export interface CandidateListItem {
  id: string;
  makeName: string;
  modelName: string;
  variantName: string | null;
  yearFrom: number;
  yearTo: number | null;
  provider: string;
  status: string;
  fieldCount: number;
  hasOverride: boolean;
  resultingVariantId: string | null;
  createdBy: string | null;
  createdAt: string;
}

const BODY_TYPES = [
  '',
  'DUAL_CAB_UTE',
  'SINGLE_CAB_UTE',
  'EXTRA_CAB_UTE',
  'WAGON',
  'SUV',
  'VAN',
  'TROOPCARRIER',
  'OTHER',
] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  DEFERRED: 'bg-gray-100 text-gray-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}

export function SpecFetchConsole({
  initialItems,
}: {
  initialItems: CandidateListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    makeName: '',
    modelName: '',
    variantName: '',
    yearFrom: '',
    yearTo: '',
    bodyType: '' as string,
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const items =
    statusFilter === 'ALL'
      ? initialItems
      : initialItems.filter((i) => i.status === statusFilter);

  function onFetch() {
    setError(null);
    const yearFrom = parseInt(form.yearFrom, 10);
    if (!form.makeName.trim() || !form.modelName.trim() || !yearFrom) {
      setError('Make, model and year are required.');
      return;
    }
    startTransition(async () => {
      const res = await fetchCandidate(
        {
          makeName: form.makeName.trim(),
          modelName: form.modelName.trim(),
          variantName: form.variantName.trim() || null,
          yearFrom,
          yearTo: form.yearTo ? parseInt(form.yearTo, 10) : null,
          bodyType: (form.bodyType || null) as never,
        },
        'MOCK',
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push(
        `/admin/catalogue/vehicles/spec-fetch/${res.data.candidateId}`,
      );
    });
  }

  return (
    <div className="space-y-8">
      {/* Fetch form */}
      <section className="border-tb-neutral-200 rounded-lg border bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Fetch a candidate spec
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Provider: <span className="font-medium">MOCK</span> (returns the
          LandCruiser fixture for Toyota LandCruiser; nulls otherwise). Live
          QWEN/Claude fetches are gated off tonight — see the morning TODO.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">
            Make *
            <input
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.makeName}
              onChange={(e) => setForm({ ...form, makeName: e.target.value })}
              placeholder="Toyota"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Model *
            <input
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.modelName}
              onChange={(e) => setForm({ ...form, modelName: e.target.value })}
              placeholder="LandCruiser 100"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Variant
            <input
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.variantName}
              onChange={(e) =>
                setForm({ ...form, variantName: e.target.value })
              }
              placeholder="GXL 4.2TD"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Year from *
            <input
              type="number"
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.yearFrom}
              onChange={(e) => setForm({ ...form, yearFrom: e.target.value })}
              placeholder="2005"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Year to
            <input
              type="number"
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.yearTo}
              onChange={(e) => setForm({ ...form, yearTo: e.target.value })}
              placeholder="2007"
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Body type
            <select
              className="border-tb-neutral-300 mt-1 w-full rounded border px-2 py-1.5 text-sm text-gray-900"
              value={form.bodyType}
              onChange={(e) => setForm({ ...form, bodyType: e.target.value })}
            >
              {BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b || '—'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          onClick={onFetch}
          disabled={pending}
          className="bg-tb-primary hover:bg-tb-primary-light mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Fetching…' : 'Fetch candidate'}
        </button>
      </section>

      {/* Candidate list */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Candidates ({items.length})
          </h2>
          <select
            className="border-tb-neutral-300 rounded border px-2 py-1 text-xs text-gray-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b text-gray-700">
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Fields</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No candidates yet — fetch one above.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr
                    key={c.id}
                    className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                  >
                    <td className="px-4 py-3 text-gray-900">
                      {c.makeName} {c.modelName}
                      {c.variantName ? ` ${c.variantName}` : ''}
                      {c.hasOverride && (
                        <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                          override
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.yearFrom}
                      {c.yearTo && c.yearTo !== c.yearFrom
                        ? `–${c.yearTo}`
                        : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.provider}</td>
                    <td className="px-4 py-3 text-gray-600">{c.fieldCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('en-AU')}
                      {c.createdBy ? ` · ${c.createdBy}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/catalogue/vehicles/spec-fetch/${c.id}`}
                        className="text-tb-primary text-sm font-medium hover:underline"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
