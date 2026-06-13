import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import {
  listRegulationVersionsAction,
  getRegulationSetAction,
} from '@/modules/regulations/actions/regulation.actions';
import { VersionHistoryClient } from './_components/VersionHistoryClient';
import { auth } from '@/lib/auth';

export default async function RegulationVersionsPage({
  params,
}: {
  params: Promise<{ setKey: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    redirect('/admin');
  }

  const { setKey } = await params;
  const [setResult, versions] = await Promise.all([
    getRegulationSetAction(setKey),
    listRegulationVersionsAction(setKey),
  ]);

  if (!setResult) notFound();
  const { set } = setResult;

  return (
    <div>
      <AdminPageHeader
        title={`${set.name} — Version History`}
        description={`All saved versions for ${set.code}. Versions are immutable; the most recent effective version is used in calculations.`}
        actions={
          <Link
            href={`/admin/regulations/${set.code}`}
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            ← Edit Current
          </Link>
        }
      />

      <div className="text-tb-neutral-500 mb-4 flex items-center gap-2 text-sm">
        <Link href="/admin/regulations" className="hover:text-blue-600">
          Regulation Sets
        </Link>
        <span>/</span>
        <Link
          href={`/admin/regulations/${set.code}`}
          className="hover:text-blue-600"
        >
          {set.name}
        </Link>
        <span>/</span>
        <span className="text-gray-700">Version History</span>
      </div>

      <VersionHistoryClient versions={versions} />
    </div>
  );
}
