import { AdminPageHeader } from "@/modules/admin/components";
import { listAllPlacementsAction } from "@/modules/sponsorship/actions/sponsor-admin.actions";
import { ScheduleView } from "./_components/ScheduleView";
import Link from "next/link";

export const metadata = { title: "Placement Schedule — Admin" };

export default async function SchedulePage() {
  const placements = await listAllPlacementsAction();

  return (
    <div>
      <AdminPageHeader
        title="Placement Schedule"
        description="90-day view of all active and upcoming placements, grouped by scope."
        actions={
          <Link
            href="/admin/sponsorship"
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            ← Sponsors
          </Link>
        }
      />
      <ScheduleView placements={placements} />
    </div>
  );
}
