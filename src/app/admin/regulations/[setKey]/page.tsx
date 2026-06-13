import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import { getRegulationSetAction } from '@/modules/regulations/actions/regulation.actions';
import { RegulationEditForm } from './_components/RegulationEditForm';
import { auth } from '@/lib/auth';

export default async function RegulationSetPage({
  params,
}: {
  params: Promise<{ setKey: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin');
  }

  const { setKey } = await params;
  const result = await getRegulationSetAction(setKey);
  if (!result) notFound();

  const { set, currentData } = result;

  return (
    <div>
      <AdminPageHeader
        title={set.name}
        description={`Regulation set for ${set.market} — Code: ${set.code}`}
        actions={
          <Link
            href={`/admin/regulations/${set.code}/versions`}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            Version History
          </Link>
        }
      />

      <div className="text-tb-neutral-500 mb-4 flex items-center gap-2 text-sm">
        <Link href="/admin/regulations" className="hover:text-blue-600">
          Regulation Sets
        </Link>
        <span>/</span>
        <span className="text-gray-700">{set.name}</span>
        {set.currentVersionNumber != null && set.currentVersionNumber > 0 ? (
          <>
            <span>&mdash;</span>
            <span>
              Current: v{set.currentVersionNumber}
              {set.currentVersionDate && (
                <span className="text-tb-neutral-400 ml-1">
                  (effective{' '}
                  {new Date(set.currentVersionDate).toLocaleDateString('en-AU')}
                  )
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-tb-neutral-400 italic">
            &mdash; No versions yet
          </span>
        )}
      </div>

      <div className="border-tb-neutral-200 rounded-lg border bg-white p-6">
        <RegulationEditForm code={set.code} initialData={currentData} />
      </div>
    </div>
  );
}
