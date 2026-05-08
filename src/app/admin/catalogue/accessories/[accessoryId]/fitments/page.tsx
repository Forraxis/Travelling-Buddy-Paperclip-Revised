import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/modules/admin/components";
import {
  getAccessoryByIdAction,
  listFitmentsForAccessoryAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import { FitmentsList } from "./FitmentsList";

export default async function FitmentsPage({
  params,
}: {
  params: Promise<{ accessoryId: string }>;
}) {
  const { accessoryId } = await params;
  const [accessory, fitments] = await Promise.all([
    getAccessoryByIdAction(accessoryId),
    listFitmentsForAccessoryAction(accessoryId),
  ]);
  if (!accessory) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`Fitments — ${accessory.name}`}
        description="Manage fitments for vehicle and caravan variants."
        actions={
          <div className="flex gap-2">
            <Link
              href={`/admin/catalogue/accessories/${accessoryId}`}
              className="rounded-lg border border-tb-neutral-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
            >
              ← Back to Accessory
            </Link>
            <Link
              href={`/admin/catalogue/accessories/${accessoryId}/fitments/new`}
              className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
            >
              + Add Fitment
            </Link>
          </div>
        }
      />
      <FitmentsList fitments={fitments} accessoryId={accessoryId} />
    </div>
  );
}
