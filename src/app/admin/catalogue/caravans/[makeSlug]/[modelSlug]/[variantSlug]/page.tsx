import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getCaravanModelBySlugAction,
} from "@/modules/catalogue/actions/caravan.actions";
import { CaravanVariantForm } from "../CaravanVariantForm";

export default async function CaravanVariantDetailPage({
  params,
}: {
  params: Promise<{ makeSlug: string; modelSlug: string; variantSlug: string }>;
}) {
  const { makeSlug, modelSlug, variantSlug } = await params;

  if (variantSlug === "new") {
    const model = await getCaravanModelBySlugAction(makeSlug, modelSlug);
    if (!model) notFound();
    return (
      <div>
        <AdminPageHeader
          title={`New Variant — ${model.make.name} ${model.name}`}
          description="Add a new caravan variant with specifications"
        />
        <CaravanVariantForm
          modelId={model.id}
          backHref={`/admin/catalogue/caravans/${makeSlug}/${modelSlug}`}
        />
      </div>
    );
  }

  const model = await getCaravanModelBySlugAction(makeSlug, modelSlug);
  if (!model) notFound();
  const variant = model.variants.find((v) => v.slug === variantSlug);
  if (!variant) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`${model.make.name} ${model.name} — ${variant.name}`}
        description={`Edit caravan variant details and specifications`}
      />
      <CaravanVariantForm
        modelId={model.id}
        variant={variant}
        backHref={`/admin/catalogue/caravans/${makeSlug}/${modelSlug}`}
      />
    </div>
  );
}
