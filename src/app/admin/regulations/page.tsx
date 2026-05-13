import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/modules/admin/components";
import { listRegulationSetsAction } from "@/modules/regulations/actions/regulation.actions";
import { auth } from "@/lib/auth";

export default async function RegulationsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/admin");
  }

  const sets = await listRegulationSetsAction();

  return (
    <div>
      <AdminPageHeader
        title="Regulation Sets"
        description="Manage versioned towing regulation sets for AU federal and state/territory jurisdictions."
      />

      <div className="mt-6 overflow-hidden rounded-lg border border-tb-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-tb-neutral-200">
          <thead className="bg-tb-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Market
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Current Version
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-tb-neutral-500">
                Last Updated
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-tb-neutral-100">
            {sets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-tb-neutral-400"
                >
                  No regulation sets found. Seed the database to populate defaults.
                </td>
              </tr>
            ) : (
              sets.map((s) => (
                <tr key={s.id} className="hover:bg-tb-neutral-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-tb-neutral-600">
                    {s.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-600">
                    {s.market}
                  </td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-600">
                    {s.currentVersionNumber != null && s.currentVersionNumber > 0 ? (
                      <span>
                        v{s.currentVersionNumber}
                        {s.currentVersionDate && (
                          <span className="ml-1 text-tb-neutral-400">
                            &mdash;{" "}
                            {new Date(s.currentVersionDate).toLocaleDateString("en-AU")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="italic text-tb-neutral-400">No versions yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-tb-neutral-500">
                    {new Date(s.lastUpdatedAt).toLocaleDateString("en-AU")}
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
