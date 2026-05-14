import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getAdminUser } from "@/modules/admin/lib/auth";
import { AnalyticsTabs } from "../_components/AnalyticsTabs";

// recharts 3.x imports victory-vendor via wildcard exports (./d3-*) which
// Turbopack cannot resolve at compile time, hanging the dev server. Load
// client-side only to keep recharts out of the server compilation graph.
const SubmissionStatsView = dynamic(
  () =>
    import("./_components/SubmissionStatsView").then(
      (m) => m.SubmissionStatsView
    ),
  { ssr: false }
);
import {
  getSubmissionsOverTime,
  getApprovalRates,
  getRejectionReasons,
  getModerationTiming,
  getVlmAccuracy,
  getTrustTierDistribution,
  getTopContributors,
} from "@/modules/admin/actions/analytics.actions";

export const metadata = { title: "Submission Stats — Admin" };

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function SubmissionStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getAdminUser();
  if (!user || user.role !== "ADMIN") redirect("/admin");

  const params = await searchParams;

  const defaultTo = new Date();
  defaultTo.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = parseDate(params.from, defaultFrom);
  from.setHours(0, 0, 0, 0);
  const to = parseDate(params.to, defaultTo);
  to.setHours(23, 59, 59, 999);

  const range = { from, to };

  const [overTime, approvalRates, rejectionReasons, moderationTiming, vlmAccuracy, trustTiers, topContributors] =
    await Promise.all([
      getSubmissionsOverTime(range),
      getApprovalRates(range),
      getRejectionReasons(range),
      getModerationTiming(range),
      getVlmAccuracy(range),
      getTrustTierDistribution(),
      getTopContributors(range),
    ]);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform usage insights and performance metrics
        </p>
      </div>
      <AnalyticsTabs active="submissions" />
      <SubmissionStatsView
        data={{
          overTime,
          approvalRates,
          rejectionReasons,
          moderationTiming,
          vlmAccuracy,
          trustTiers,
          topContributors,
          from: fromStr,
          to: toStr,
        }}
      />
    </div>
  );
}
