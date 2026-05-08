import { AdminPageHeader } from "@/modules/admin/components";
import { listCaravanMakesAction } from "@/modules/catalogue/actions/caravan.actions";
import { CaravanMakesList } from "./CaravanMakesList";

export default async function CaravansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const cursor = params.cursor;
  const result = await listCaravanMakesAction(cursor, search || undefined);

  return (
    <div>
      <AdminPageHeader
        title="Caravans"
        description="Manage the caravan catalogue — add, edit, and organise caravan entries."
      />
      <CaravanMakesList
        initialData={result}
        initialSearch={search}
      />
    </div>
  );
}
