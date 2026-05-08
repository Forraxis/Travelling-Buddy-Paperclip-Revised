import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import { getAccessoryByIdAction } from "@/modules/catalogue/actions/accessory-admin.actions";
import { FitmentForm } from "../FitmentForm";

export default async function NewFitmentPage({
  params,
}: {
  params: Promise<{ accessoryId: string }>;
}) {
  const { accessoryId } = await params;
  const accessory = await getAccessoryByIdAction(accessoryId);
  if (!accessory) notFound();

  return (
    <div>
      <AdminPageHeader
        title="New Fitment"
        description={`Add a fitment for ${accessory.name}.`}
      />
      <FitmentForm
        accessoryId={accessoryId}
        backHref={`/admin/catalogue/accessories/${accessoryId}/fitments`}
      />
    </div>
  );
}
