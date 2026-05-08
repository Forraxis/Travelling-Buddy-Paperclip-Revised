import { AdminPageHeader } from '@/modules/admin/components';

export default function VehiclesPage() {
  return (
    <div>
      <AdminPageHeader
        title="Vehicles"
        description="Manage the vehicle catalogue — add, edit, and organise vehicle entries."
      />
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-8 text-center text-sm text-gray-500">
        Vehicle catalogue CRUD will be implemented in Phase 2.4.
      </div>
    </div>
  );
}
