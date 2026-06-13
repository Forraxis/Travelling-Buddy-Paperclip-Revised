'use client';

import { useState } from 'react';
import Link from 'next/link';
import { inputClassName } from '@/modules/admin/components/FormField';
import type { SponsorDto } from '@/modules/sponsorship/actions/sponsor-admin.actions';

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

export function SponsorsList({
  initialSponsors,
}: {
  initialSponsors: SponsorDto[];
}) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? initialSponsors.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.contactName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (s.contactEmail ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : initialSponsors;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search sponsors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
      </div>

      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Billing Ref
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">Contact</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Placements
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? 'No sponsors match your search.'
                    : "No sponsors yet. Click '+ New Sponsor' to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((sponsor) => (
                <tr
                  key={sponsor.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sponsorship/${sponsor.id}`}
                      className="text-tb-primary font-medium hover:underline"
                    >
                      {sponsor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[sponsor.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {sponsor.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {sponsor.billingReference ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {sponsor.contactName ? (
                      <span>
                        {sponsor.contactName}
                        {sponsor.contactEmail && (
                          <span className="block text-xs text-gray-400">
                            {sponsor.contactEmail}
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {sponsor.placementCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/sponsorship/${sponsor.id}`}
                      className="hover:text-tb-primary text-sm text-gray-500"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
