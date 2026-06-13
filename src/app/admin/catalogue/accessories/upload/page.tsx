import Link from 'next/link';
import { AdminPageHeader } from '@/modules/admin/components';
import { AccessoryUploadClient } from './AccessoryUploadClient';

export default function AccessoryUploadPage() {
  return (
    <div>
      <AdminPageHeader
        title="Bulk Upload Accessories"
        description="Import accessories from a CSV file. Brands and categories are created automatically if they don't exist."
        actions={
          <Link
            href="/admin/catalogue/accessories"
            className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
          >
            ← Back to accessories
          </Link>
        }
      />
      <AccessoryUploadClient />
    </div>
  );
}
