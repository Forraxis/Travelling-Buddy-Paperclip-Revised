import Link from "next/link";
import { AdminPageHeader } from "@/modules/admin/components";
import { CaravanUploadClient } from "./CaravanUploadClient";

export default function CaravanUploadPage() {
  return (
    <div>
      <AdminPageHeader
        title="Bulk Upload Caravans"
        description="Import caravan makes, models, and variants from a CSV file."
        actions={
          <Link
            href="/admin/catalogue/caravans"
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            ← Back to caravans
          </Link>
        }
      />
      <CaravanUploadClient />
    </div>
  );
}
