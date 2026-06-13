import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import { getCaravanMakeBySlugAction } from '@/modules/catalogue/actions/caravan.actions';
import { CaravanModelsList } from './CaravanModelsList';

export default async function CaravanMakeModelsPage({
  params,
}: {
  params: Promise<{ makeSlug: string }>;
}) {
  const { makeSlug } = await params;
  const make = await getCaravanMakeBySlugAction(makeSlug);
  if (!make) notFound();

  return (
    <div>
      <AdminPageHeader
        title={make.name}
        description={`Models for ${make.name} — ${make.models.length} model${make.models.length !== 1 ? 's' : ''}`}
      />
      <CaravanModelsList make={make} />
    </div>
  );
}
