import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import { getMakeBySlugAction } from "@/modules/catalogue/actions/vehicle.actions";
import { VehicleModelsList } from "./VehicleModelsList";

export default async function MakeModelsPage({
  params,
}: {
  params: Promise<{ makeSlug: string }>;
}) {
  const { makeSlug } = await params;
  const make = await getMakeBySlugAction(makeSlug);
  if (!make) notFound();

  return (
    <div>
      <AdminPageHeader
        title={make.name}
        description={`Models for ${make.name} — ${make.models.length} model${make.models.length !== 1 ? "s" : ""}`}
      />
      <VehicleModelsList make={make} />
    </div>
  );
}
