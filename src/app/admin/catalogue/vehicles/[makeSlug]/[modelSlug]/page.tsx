import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/modules/admin/components';
import { getModelBySlugAction } from '@/modules/catalogue/actions/vehicle.actions';
import { VehicleVariantsList } from './VehicleVariantsList';

export default async function ModelVariantsPage({
  params,
}: {
  params: Promise<{ makeSlug: string; modelSlug: string }>;
}) {
  const { makeSlug, modelSlug } = await params;
  const model = await getModelBySlugAction(makeSlug, modelSlug);
  if (!model) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`${model.make.name} ${model.name}`}
        description={`Variants — ${model.variants.length} variant${model.variants.length !== 1 ? 's' : ''}`}
      />
      <VehicleVariantsList model={model} makeSlug={makeSlug} />
    </div>
  );
}
