import Link from "next/link";
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
        actions={
          <Link
            href="/admin/catalogue/vehicles/upload"
            className="rounded-lg border border-tb-neutral-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            ↑ Upload CSV
          </Link>
        }
      />
      <VehicleMakesList
        initialData={result}
        initialSearch={search}
      />
    </div>
  );
}
