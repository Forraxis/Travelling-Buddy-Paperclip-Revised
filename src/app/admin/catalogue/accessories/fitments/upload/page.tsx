import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import { AccessoryFitmentUploadClient } from './AccessoryFitmentUploadClient';

export default function AccessoryFitmentUploadPage() {
  return (
    <div>
      <AdminPageHeader
        title="Bulk Upload Accessory Fitments"
        description="Import accessory fitment data from a CSV file. Accessories and variants must already exist."
        actions={
          <Link
            href="/admin/catalogue/accessories"
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
          >
            ← Back to accessories
          </Link>
        }
      />
      <AccessoryFitmentUploadClient />
    </div>
  );
}
