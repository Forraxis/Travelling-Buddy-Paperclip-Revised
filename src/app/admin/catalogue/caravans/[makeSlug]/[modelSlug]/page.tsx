import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import { getCaravanModelBySlugAction } from "@/modules/catalogue/actions/caravan.actions";
import { CaravanVariantsList } from "./CaravanVariantsList";

export default async function CaravanModelVariantsPage({
  params,
}: {
  params: Promise<{ makeSlug: string; modelSlug: string }>;
}) {
  const { makeSlug, modelSlug } = await params;
  const model = await getCaravanModelBySlugAction(makeSlug, modelSlug);
  if (!model) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`${model.make.name} ${model.name}`}
        description={`Variants — ${model.variants.length} variant${model.variants.length !== 1 ? "s" : ""}`}
      />
      <CaravanVariantsList model={model} makeSlug={makeSlug} />
    </div>
  );
}
