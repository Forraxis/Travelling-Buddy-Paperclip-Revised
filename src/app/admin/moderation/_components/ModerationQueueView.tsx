"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { UnifiedSubmission } from "./types";
import { verdictLabel, verdictPriority } from "./types";
import type { SubmissionType } from "../actions";
import { approveSubmission, rejectSubmission } from "../actions";

const TYPE_COLORS: Record<SubmissionType, string> = {
  vehicle: "bg-blue-100 text-blue-700",
  caravan: "bg-purple-100 text-purple-700",
  accessory: "bg-teal-100 text-teal-700",
};

const VERDICT_COLORS: Record<string, string> = {
  AUTO_APPROVE: "bg-green-100 text-green-700",
  QUEUE_FOR_REVIEW: "bg-yellow-100 text-yellow-700",
  AUTO_REJECT: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-500",
};

const TRUST_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-600",
  BASIC: "bg-blue-50 text-blue-600",
  TRUSTED: "bg-green-50 text-green-700",
  EXPERT: "bg-purple-50 text-purple-700",
};

function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getAge(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

interface RejectModalProps {
  id: string;
  type: SubmissionType;
  entityName: string;
  onClose: () => void;
  onDone: () => void;
}

function RejectModal({ id, type, entityName, onClose, onDone }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("Reason is required"); return; }
    setBusy(true);
    const result = await rejectSubmission(id, type, reason.trim());
    setBusy(false);
    if (!result.success) { setError(result.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-1 text-base font-semibold text-gray-900">Reject Submission</h3>
        <p className="mb-4 text-sm text-gray-500 truncate">{entityName}</p>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tb-primary"
          rows={3}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null); }}
          placeholder="Explain why this submission is being rejected…"
          autoFocus
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface Props {
  submissions: UnifiedSubmission[];
}

export function ModerationQueueView({ submissions }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"review" | "spotcheck">("review");
  const [filterType, setFilterType] = useState<SubmissionType | "all">("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterVerdict, setFilterVerdict] = useState<string>("all");
  const [filterAge, setFilterAge] = useState<"all" | "1d" | "3d" | "7d+">("all");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<UnifiedSubmission | null>(null);
  const [busyApprove, setBusyApprove] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviewQueue = useMemo(() =>
    submissions
      .filter((s) => s.vlmVerdict !== "AUTO_APPROVE")
      .sort((a, b) => verdictPriority(a.vlmVerdict) - verdictPriority(b.vlmVerdict)),
    [submissions]
  );

  const spotcheckQueue = useMemo(() =>
    submissions.filter((s) => s.vlmVerdict === "AUTO_APPROVE"),
    [submissions]
  );

  const source = tab === "review" ? reviewQueue : spotcheckQueue;

  const filtered = useMemo(() => {
    let list = source;
    if (filterType !== "all") list = list.filter((s) => s.type === filterType);
    if (filterTier !== "all") list = list.filter((s) => s.submitter.trustTier === filterTier);
    if (filterVerdict !== "all") list = list.filter((s) => (s.vlmVerdict ?? "none") === filterVerdict);
    if (filterAge === "1d") list = list.filter((s) => getAge(s.createdAt) <= 1);
    else if (filterAge === "3d") list = list.filter((s) => getAge(s.createdAt) <= 3);
    else if (filterAge === "7d+") list = list.filter((s) => getAge(s.createdAt) >= 7);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.entityName.toLowerCase().includes(q) || (s.submitter.name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [source, filterType, filterTier, filterVerdict, filterAge, search]);

  async function handleApprove(sub: UnifiedSubmission) {
    setBusyApprove(sub.id);
    setActionError(null);
    const result = await approveSubmission(sub.id, sub.type);
    setBusyApprove(null);
    if (!result.success) setActionError(result.error);
    else router.refresh();
  }

  const chipBase = "rounded-full border px-3 py-1 text-xs font-medium cursor-pointer transition-colors";
  const chipActive = "border-tb-primary bg-tb-primary text-white";
  const chipInactive = "border-gray-300 bg-white text-gray-600 hover:border-tb-primary hover:text-tb-primary";

  return (
    <div className="space-y-4">
      {rejectTarget && (
        <RejectModal
          id={rejectTarget.id}
          type={rejectTarget.type}
          entityName={rejectTarget.entityName}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); router.refresh(); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Moderation Queue</h1>
          <p className="text-sm text-gray-500">
            {reviewQueue.length} pending review · {spotcheckQueue.length} spot-check
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(["review", "spotcheck"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-tb-primary text-tb-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "review" ? `Review Queue (${reviewQueue.length})` : `Spot-check (${spotcheckQueue.length})`}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search by name or submitter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-tb-primary"
        />

        {(["all", "vehicle", "caravan", "accessory"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilterType(v)}
            className={`${chipBase} ${filterType === v ? chipActive : chipInactive}`}
          >
            {v === "all" ? "All types" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200" />

        {["all", "NEW", "BASIC", "TRUSTED", "EXPERT"].map((v) => (
          <button
            key={v}
            onClick={() => setFilterTier(v)}
            className={`${chipBase} ${filterTier === v ? chipActive : chipInactive}`}
          >
            {v === "all" ? "All tiers" : v}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200" />

        {[
          { value: "all", label: "All verdicts" },
          { value: "QUEUE_FOR_REVIEW", label: "Mixed signals" },
          { value: "AUTO_REJECT", label: "Likely problematic" },
          { value: "AUTO_APPROVE", label: "Likely good" },
          { value: "none", label: "No assessment" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterVerdict(value)}
            className={`${chipBase} ${filterVerdict === value ? chipActive : chipInactive}`}
          >
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200" />

        {(["all", "1d", "3d", "7d+"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setFilterAge(v)}
            className={`${chipBase} ${filterAge === v ? chipActive : chipInactive}`}
          >
            {v === "all" ? "Any age" : v}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <p className="text-lg">Queue is empty</p>
          <p className="text-sm mt-1">No submissions match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VLM Verdict</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((sub) => {
                const verdictKey = sub.vlmVerdict ?? "none";
                return (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {sub.photoUrl ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                          <Image
                            src={sub.photoUrl}
                            alt="submission"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                          No photo
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/moderation/${sub.id}?type=${sub.type}`}
                        className="block hover:underline"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[sub.type]}`}>
                            {sub.type}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {sub.entityName}
                          </span>
                        </div>
                        {sub.vlmSummary && (
                          <p className="text-xs text-gray-500 truncate max-w-sm">{sub.vlmSummary}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-800">{sub.submitter.name ?? "Unknown"}</div>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TRUST_COLORS[sub.submitter.trustTier] ?? "bg-gray-100 text-gray-500"}`}>
                        {sub.submitter.trustTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_COLORS[verdictKey] ?? VERDICT_COLORS.none}`}>
                        {verdictLabel(sub.vlmVerdict)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatAge(sub.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/moderation/${sub.id}?type=${sub.type}`}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                        >
                          Review
                        </Link>
                        <button
                          onClick={() => handleApprove(sub)}
                          disabled={busyApprove === sub.id}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60 whitespace-nowrap"
                        >
                          {busyApprove === sub.id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejectTarget(sub)}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
