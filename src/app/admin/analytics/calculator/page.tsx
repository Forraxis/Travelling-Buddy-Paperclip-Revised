import { redirect } from "next/navigation";
import { getAdminUser } from "@/modules/admin/lib/auth";
import { AnalyticsTabs } from "../_components/AnalyticsTabs";

export const metadata = { title: "Calculator Analytics — Admin" };

export default async function CalculatorAnalyticsPage() {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform usage insights and performance metrics
        </p>
      </div>
      <AnalyticsTabs active="calculator" />
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
        <div className="mx-auto max-w-sm">
          <div className="text-4xl mb-4">🧮</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Calculator Usage Analytics
          </h3>
          <p className="text-sm text-gray-500">
            Metrics for the tow-capacity and compliance calculators will appear
            here once in-product event tracking is enabled. This dashboard is
            coming in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
