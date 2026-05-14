"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  SubmissionsOverTimeRow,
  ApprovalRate,
  RejectionReason,
  ModerationTiming,
  VlmAccuracy,
  TrustTierCount,
  TopContributor,
} from "@/modules/admin/actions/analytics.actions";

export interface SubmissionStatsData {
  overTime: SubmissionsOverTimeRow[];
  approvalRates: ApprovalRate[];
  rejectionReasons: RejectionReason[];
  moderationTiming: ModerationTiming;
  vlmAccuracy: VlmAccuracy;
  trustTiers: TrustTierCount[];
  topContributors: TopContributor[];
  from: string;
  to: string;
}

const TYPE_COLORS = {
  vehicle: "#6366f1",
  caravan: "#8b5cf6",
  accessory: "#06b6d4",
};

const TIER_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  BASIC: "#60a5fa",
  TRUSTED: "#34d399",
  EXPERT: "#f59e0b",
};

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className="mt-1 text-3xl font-bold"
        style={{ color: color ?? "#111827" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function SubmissionStatsView({ data }: { data: SubmissionStatsData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [from, setFrom] = useState(data.from);
  const [to, setTo] = useState(data.to);

  const applyDateRange = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    startTransition(() => {
      router.push(`/admin/analytics/submissions?${params.toString()}`);
    });
  }, [from, to, router, searchParams]);

  const totalApproved = data.approvalRates.reduce((s, r) => s + r.approved, 0);
  const totalRejected = data.approvalRates.reduce((s, r) => s + r.rejected, 0);
  const totalDecided = totalApproved + totalRejected;
  const overallRate =
    totalDecided > 0 ? Math.round((totalApproved / totalDecided) * 100) : 0;

  const shortDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
  };

  return (
    <div className="space-y-8">
      {/* Date range picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 font-medium">Date range:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-gray-400">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={applyDateRange}
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Loading…" : "Apply"}
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Overall approval rate"
          value={`${overallRate}%`}
          sub={`${totalApproved} approved / ${totalDecided} decided`}
          color="#10b981"
        />
        <StatCard
          label="Median time to moderation"
          value={`${data.moderationTiming.median}h`}
          sub={`p95: ${data.moderationTiming.p95}h (n=${data.moderationTiming.sampleSize})`}
        />
        <StatCard
          label="VLM auto-approve accuracy"
          value={`${data.vlmAccuracy.accuracy}%`}
          sub={`${data.vlmAccuracy.autoApprovedConfirmed}/${data.vlmAccuracy.autoApprovedTotal} confirmed`}
          color={data.vlmAccuracy.accuracy >= 80 ? "#10b981" : "#f59e0b"}
        />
        <StatCard
          label="VLM revocations"
          value={data.vlmAccuracy.autoApprovedRevoked}
          sub="auto-approved then rejected"
          color={data.vlmAccuracy.autoApprovedRevoked > 0 ? "#ef4444" : undefined}
        />
      </div>

      {/* Per-type approval rate cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Approval rates by type
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {data.approvalRates.map((r) => (
            <div
              key={r.type}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-medium capitalize"
                  style={{ color: TYPE_COLORS[r.type] }}
                >
                  {r.type}
                </span>
                <span className="text-xl font-bold text-gray-900">
                  {r.rate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${r.rate}%`,
                    backgroundColor: TYPE_COLORS[r.type],
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>{r.approved} approved</span>
                <span>{r.rejected} rejected</span>
                <span>{r.pending} pending</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submissions over time line chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Submissions over time
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data.overTime.map((d) => ({ ...d, date: shortDate(d.date) }))}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="vehicle"
              stroke={TYPE_COLORS.vehicle}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="caravan"
              stroke={TYPE_COLORS.caravan}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="accessory"
              stroke={TYPE_COLORS.accessory}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rejection reasons + Trust tier side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rejection reasons bar chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Rejection reasons
          </h2>
          {data.rejectionReasons.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No rejections in this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.rejectionReasons.map((r) => ({
                  reason:
                    r.reason.length > 22
                      ? r.reason.slice(0, 22) + "…"
                      : r.reason,
                  count: r.count,
                }))}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={130}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trust tier pie chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            User trust tier distribution
          </h2>
          {data.trustTiers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.trustTiers}
                  dataKey="count"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: { name?: string; percent?: number }) =>
                    `${entry.name ?? ""} ${Math.round((entry.percent ?? 0) * 100)}%`
                  }
                  labelLine={false}
                >
                  {data.trustTiers.map((t) => (
                    <Cell
                      key={t.tier}
                      fill={TIER_COLORS[t.tier] ?? "#9ca3af"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} users`, ""]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top contributors table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Top contributors (approved submissions)
          </h2>
        </div>
        {data.topContributors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No approved submissions in this period
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Rank</th>
                <th className="px-5 py-3 text-left font-medium">User</th>
                <th className="px-5 py-3 text-left font-medium">Trust tier</th>
                <th className="px-5 py-3 text-right font-medium">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.topContributors.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400 font-medium">
                    #{i + 1}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">
                      {c.name ?? "Anonymous"}
                    </p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          (TIER_COLORS[c.trustTier] ?? "#9ca3af") + "22",
                        color: TIER_COLORS[c.trustTier] ?? "#6b7280",
                      }}
                    >
                      {c.trustTier}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {c.approvedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
