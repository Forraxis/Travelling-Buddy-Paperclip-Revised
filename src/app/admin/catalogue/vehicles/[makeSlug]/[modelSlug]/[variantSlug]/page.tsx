import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getModelBySlugAction,
} from "@/modules/catalogue/actions/vehicle.actions";
import { VariantForm } from "../VariantForm";
import { VariantAdminActions } from "./VariantAdminActions";

export default async function VariantDetailPage({
  params,
}: {
  params: Promise<{ makeSlug: string; modelSlug: string; variantSlug: string }>;
}) {
  const { makeSlug, modelSlug, variantSlug } = await params;

  if (variantSlug === "new") {
    const model = await getModelBySlugAction(makeSlug, modelSlug);
    if (!model) notFound();
    return (
      <div>
        <AdminPageHeader
          title={`New Variant — ${model.make.name} ${model.name}`}
          description="Add a new variant with specifications"
        />
        <VariantForm
          modelId={model.id}
          backHref={`/admin/catalogue/vehicles/${makeSlug}/${modelSlug}`}
        />
      </div>
    );
  }

  const model = await getModelBySlugAction(makeSlug, modelSlug);
  if (!model) notFound();
  const variant = model.variants.find((v) => v.slug === variantSlug);
  if (!variant) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${model.make.name} ${model.name} — ${variant.name}`}
        description={`Edit variant details and specifications`}
      />
      <VariantAdminActions
        variant={variant}
        makeSlug={makeSlug}
        modelSlug={modelSlug}
      />
      <VariantForm
        modelId={model.id}
        variant={variant}
        backHref={`/admin/catalogue/vehicles/${makeSlug}/${modelSlug}`}
      />
    </div>
  );
}
