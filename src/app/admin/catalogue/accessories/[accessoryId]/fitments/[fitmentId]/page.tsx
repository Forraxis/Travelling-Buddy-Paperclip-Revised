import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getFitmentByIdAction,
  getAccessoryByIdAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import { FitmentForm } from "../FitmentForm";

export default async function FitmentDetailPage({
  params,
}: {
  params: Promise<{ accessoryId: string; fitmentId: string }>;
}) {
  const { accessoryId, fitmentId } = await params;
  const [accessory, fitment] = await Promise.all([
    getAccessoryByIdAction(accessoryId),
    getFitmentByIdAction(fitmentId),
  ]);
  if (!accessory || !fitment) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit Fitment"
        description={`Edit fitment for ${accessory.name}.`}
      />
      <FitmentForm
        accessoryId={accessoryId}
        fitment={fitment}
        backHref={`/admin/catalogue/accessories/${accessoryId}/fitments`}
      />
    </div>
  );
}
