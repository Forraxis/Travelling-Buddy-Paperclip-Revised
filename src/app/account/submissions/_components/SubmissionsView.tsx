"use client";

import type { TrustTier } from "@prisma/client";

type SubmissionStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED";

interface Submission {
  id: string;
  type: "vehicle" | "caravan" | "accessory";
  status: SubmissionStatus;
  submittedData: Record<string, unknown>;
  decisionNotes: string | null;
  decidedAt: Date | null;
  draftExpiresAt: Date | null;
  createdAt: Date;
  isShared?: boolean;
}

interface Props {
  submissions: Submission[];
  trustTier: TrustTier;
  untilTrusted: number | null;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING: "bg-yellow-50 text-yellow-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  DEFERRED: "bg-orange-50 text-orange-700",
};

const TIER_LABEL: Record<TrustTier, string> = {
  NEW: "New contributor",
  BASIC: "Contributor",
  TRUSTED: "Trusted",
  EXPERT: "Moderator",
};

function submissionTitle(s: Submission): string {
  const d = s.submittedData;
  if (s.type === "accessory") {
    const brand = (d.newBrandName as string) || "";
    const model = (d.modelName as string) || "";
    return [brand, model].filter(Boolean).join(" ") || "Unnamed accessory";
  }
  if (s.type === "vehicle" || s.type === "caravan") {
    const variant = (d.variantName as string) || "";
    const year = d.year ? `(${d.year})` : "";
    return [variant, year].filter(Boolean).join(" ") || `Unnamed ${s.type}`;
  }
  return "Submission";
}

export function SubmissionsView({ submissions, trustTier, untilTrusted }: Props) {
  const byStatus = (status: SubmissionStatus) =>
    submissions.filter((s) => s.status === status);

  const pending = byStatus("PENDING");
  const approved = byStatus("APPROVED");
  const rejected = byStatus("REJECTED");
  const drafts = byStatus("DRAFT");
  const deferred = byStatus("DEFERRED");

  return (
    <div className="space-y-6">
      {/* Trust tier banner */}
      <div className="rounded-xl border border-tb-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Trust tier: <span className="text-tb-primary">{TIER_LABEL[trustTier]}</span>
            </p>
            {untilTrusted !== null && untilTrusted > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                {untilTrusted} more approved {untilTrusted === 1 ? "submission" : "submissions"} to reach Trusted status
              </p>
            )}
            {untilTrusted === 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                You&apos;re close to Trusted status — no rejections in 30 days needed
              </p>
            )}
          </div>
        </div>
      </div>

      {submissions.length === 0 && (
        <div className="rounded-xl border border-dashed border-tb-neutral-200 p-8 text-center">
          <p className="text-sm text-gray-500">No submissions yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Use &ldquo;Vehicle not listed?&rdquo; or &ldquo;Can&apos;t find it?&rdquo; in the calculator to submit.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Pending review" items={pending} />
      )}
      {approved.length > 0 && (
        <Section title="Approved" items={approved} />
      )}
      {rejected.length > 0 && (
        <Section title="Rejected" items={rejected} showDecisionNotes />
      )}
      {deferred.length > 0 && (
        <Section title="Deferred" items={deferred} />
      )}
      {drafts.length > 0 && (
        <Section title="Drafts" items={drafts} showExpiry />
      )}
    </div>
  );
}

function Section({
  title,
  items,
  showDecisionNotes = false,
  showExpiry = false,
}: {
  title: string;
  items: Submission[];
  showDecisionNotes?: boolean;
  showExpiry?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
      <div className="divide-y divide-tb-neutral-100 rounded-xl border border-tb-neutral-200 bg-white">
        {items.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {submissionTitle(s)}
              </p>
              <p className="mt-0.5 text-xs capitalize text-gray-500">
                {s.type} · {new Date(s.createdAt).toLocaleDateString("en-AU")}
              </p>
              {showDecisionNotes && s.decisionNotes && (
                <p className="mt-1 text-xs text-red-600">Reason: {s.decisionNotes}</p>
              )}
              {showExpiry && s.draftExpiresAt && (
                <p className="mt-1 text-xs text-gray-400">
                  Expires {new Date(s.draftExpiresAt).toLocaleDateString("en-AU")}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}
            >
              {STATUS_LABEL[s.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
