import { AdminPageHeader } from "@/modules/admin/components";
import { listMakesAction } from "@/modules/catalogue/actions/vehicle.actions";
import { VehicleMakesList } from "./VehicleMakesList";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const cursor = params.cursor;
  const result = await listMakesAction(cursor, search || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Vehicles"
        description="Manage the vehicle catalogue — add, edit, and organise vehicle entries."
      />
      <VehicleMakesList
        initialData={result}
        initialSearch={search}
      />
    </div>
  );
}
