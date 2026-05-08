import Link from "next/link";
import { AdminPageHeader } from "@/modules/admin/components";
import { VehicleUploadClient } from "./VehicleUploadClient";

export default function VehicleUploadPage() {
  return (
    <div>
      <AdminPageHeader
        title="Bulk Upload Vehicles"
        description="Import vehicle makes, models, and variants from a CSV file."
        actions={
          <Link
            href="/admin/catalogue/vehicles"
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            ← Back to vehicles
          </Link>
        }
      />
      <VehicleUploadClient />
    </div>
  );
}
