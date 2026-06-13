import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import { listCaravanMakesAction } from '@/modules/catalogue/actions/caravan.actions';
import { CaravanMakesList } from './CaravanMakesList';

export default async function CaravansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? '';
  const cursor = params.cursor;
  const result = await listCaravanMakesAction(cursor, search || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Caravans"
        description="Manage the caravan catalogue — add, edit, and organise caravan entries."
        actions={
          <Link
            href="/admin/catalogue/caravans/upload"
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            ↑ Upload CSV
          </Link>
        }
      />
      <CaravanMakesList initialData={result} initialSearch={search} />
    </div>
  );
}
