import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import { listRegulationSetsAction } from '@/modules/regulations/actions/regulation.actions';
import { auth } from '@/lib/auth';

export default async function RegulationsPage() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin');
  }

  const sets = await listRegulationSetsAction();

  return (
    <div>
      <AdminPageHeader
        title="Regulation Sets"
        description="Manage versioned towing regulation sets for AU federal and state/territory jurisdictions."
      />

      <div className="border-tb-neutral-200 mt-6 overflow-hidden rounded-lg border bg-white">
        <table className="divide-tb-neutral-200 min-w-full divide-y">
          <thead className="bg-tb-neutral-50">
            <tr>
              <th className="text-tb-neutral-500 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                Name
              </th>
              <th className="text-tb-neutral-500 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                Code
              </th>
              <th className="text-tb-neutral-500 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                Market
              </th>
              <th className="text-tb-neutral-500 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                Current Version
              </th>
              <th className="text-tb-neutral-500 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase">
                Last Updated
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-tb-neutral-100 divide-y">
            {sets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-tb-neutral-400 px-4 py-8 text-center text-sm"
                >
                  No regulation sets found. Seed the database to populate
                  defaults.
                </td>
              </tr>
            ) : (
              sets.map((s) => (
                <tr key={s.id} className="hover:bg-tb-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="text-tb-neutral-600 px-4 py-3 font-mono text-sm">
                    {s.code}
                  </td>
                  <td className="text-tb-neutral-600 px-4 py-3 text-sm">
                    {s.market}
                  </td>
                  <td className="text-tb-neutral-600 px-4 py-3 text-sm">
                    {s.currentVersionNumber != null &&
                    s.currentVersionNumber > 0 ? (
                      <span>
                        v{s.currentVersionNumber}
                        {s.currentVersionDate && (
                          <span className="text-tb-neutral-400 ml-1">
                            &mdash;{' '}
                            {new Date(s.currentVersionDate).toLocaleDateString(
                              'en-AU',
                            )}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-tb-neutral-400 italic">
                        No versions yet
                      </span>
                    )}
                  </td>
                  <td className="text-tb-neutral-500 px-4 py-3 text-sm">
                    {new Date(s.lastUpdatedAt).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/admin/regulations/${s.code}`}
                      className="mr-3 text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/regulations/${s.code}/versions`}
                      className="text-tb-neutral-500 hover:underline"
                    >
                      History
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
