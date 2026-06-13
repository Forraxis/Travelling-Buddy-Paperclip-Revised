'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TrustTier } from '@prisma/client';

type SubmissionStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEFERRED';

interface Submission {
  id: string;
  type: 'vehicle' | 'caravan' | 'accessory';
  status: SubmissionStatus;
  submittedData: Record<string, unknown>;
  decisionNotes: string | null;
  decidedAt: Date | null;
  draftExpiresAt: Date | null;
  createdAt: Date;
  isShared?: boolean;
  catalogueUrl: string | null;
  queuePosition: number | null;
}

interface Props {
  submissions: Submission[];
  trustTier: TrustTier;
  untilTrusted: number | null;
  showSuccessBanner: boolean;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DEFERRED: 'Deferred',
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  DEFERRED: 'bg-orange-50 text-orange-700',
};

const TYPE_LABEL: Record<Submission['type'], string> = {
  vehicle: 'Vehicle',
  caravan: 'Caravan',
  accessory: 'Accessory',
};

const TYPE_CLASS: Record<Submission['type'], string> = {
  vehicle: 'bg-blue-50 text-blue-700',
  caravan: 'bg-purple-50 text-purple-700',
  accessory: 'bg-teal-50 text-teal-700',
};

const TIER_LABEL: Record<TrustTier, string> = {
  NEW: 'New contributor',
  BASIC: 'Contributor',
  TRUSTED: 'Trusted',
  EXPERT: 'Moderator',
};

function submissionTitle(s: Submission): string {
  const d = s.submittedData;
  if (s.type === 'accessory') {
    const brand = (d.newBrandName as string) || '';
    const model = (d.modelName as string) || '';
    return [brand, model].filter(Boolean).join(' ') || 'Unnamed accessory';
  }
  if (s.type === 'vehicle' || s.type === 'caravan') {
    const variant = (d.variantName as string) || '';
    const year = d.year ? `(${d.year})` : '';
    return [variant, year].filter(Boolean).join(' ') || `Unnamed ${s.type}`;
  }
  return 'Submission';
}

function resubmitUrl(s: Submission): string | null {
  if (s.type === 'vehicle') return `/submit/vehicle?resubmit=${s.id}`;
  if (s.type === 'caravan') return `/submit/caravan?resubmit=${s.id}`;
  return null;
}

export function SubmissionsView({
  submissions,
  trustTier,
  untilTrusted,
  showSuccessBanner,
}: Props) {
  const router = useRouter();
  const [bannerVisible, setBannerVisible] = useState(showSuccessBanner);

  // Remove ?submitted=1 from URL once the banner has been shown
  useEffect(() => {
    if (showSuccessBanner) {
      router.replace('/account/submissions');
    }
  }, [showSuccessBanner, router]);

  const byStatus = (status: SubmissionStatus) =>
    submissions.filter((s) => s.status === status);

  const pending = byStatus('PENDING');
  const approved = byStatus('APPROVED');
  const rejected = byStatus('REJECTED');
  const drafts = byStatus('DRAFT');
  const deferred = byStatus('DEFERRED');

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {bannerVisible && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Submission received
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              Your submission is now in the review queue. You can track its
              status below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBannerVisible(false)}
            className="shrink-0 text-green-500 hover:text-green-700"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Trust tier banner */}
      <div className="border-tb-neutral-200 rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Trust tier:{' '}
              <span className="text-tb-primary">{TIER_LABEL[trustTier]}</span>
            </p>
            {untilTrusted !== null && untilTrusted > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                {untilTrusted} more approved{' '}
                {untilTrusted === 1 ? 'submission' : 'submissions'} to reach
                Trusted status
              </p>
            )}
            {untilTrusted === 0 && (
              <p className="mt-0.5 text-xs text-gray-500">
                You&apos;re close to Trusted status — no rejections in 30 days
                needed
              </p>
            )}
          </div>
        </div>
      </div>

      {submissions.length === 0 && (
        <div className="border-tb-neutral-200 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-gray-500">No submissions yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Use &ldquo;Vehicle not listed?&rdquo; or &ldquo;Can&apos;t find
            it?&rdquo; in the calculator to submit.
          </p>
        </div>
      )}

      {pending.length > 0 && <Section title="Pending review" items={pending} />}
      {approved.length > 0 && <Section title="Approved" items={approved} />}
      {rejected.length > 0 && <Section title="Rejected" items={rejected} />}
      {deferred.length > 0 && <Section title="Deferred" items={deferred} />}
      {drafts.length > 0 && <Section title="Drafts" items={drafts} />}
    </div>
  );
}

function Section({ title, items }: { title: string; items: Submission[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
      <div className="divide-tb-neutral-100 border-tb-neutral-200 divide-y rounded-xl border bg-white">
        {items.map((s) => (
          <SubmissionRow key={s.id} s={s} />
        ))}
      </div>
    </div>
  );
}

function SubmissionRow({ s }: { s: Submission }) {
  const url = resubmitUrl(s);

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Title + type badge */}
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-gray-900">
              {submissionTitle(s)}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLASS[s.type]}`}
            >
              {TYPE_LABEL[s.type]}
            </span>
            {s.type === 'accessory' && s.isShared === false && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Private
              </span>
            )}
          </div>

          {/* Submitted date */}
          <p className="mt-0.5 text-xs text-gray-500">
            Submitted {new Date(s.createdAt).toLocaleDateString('en-AU')}
          </p>

          {/* Status-specific affordances */}
          {s.status === 'PENDING' && s.queuePosition !== null && (
            <p className="mt-1 text-xs text-yellow-700">
              {s.queuePosition === 1
                ? 'Next in queue — typically reviewed within a few days'
                : `Position ~${s.queuePosition} in the review queue`}
            </p>
          )}

          {s.status === 'APPROVED' && s.catalogueUrl && (
            <Link
              href={s.catalogueUrl}
              className="text-tb-primary mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              View in catalogue
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          )}

          {s.status === 'REJECTED' && (
            <div className="mt-1 space-y-1">
              {s.decisionNotes && (
                <p className="text-xs text-red-600">
                  <span className="font-medium">Reason:</span> {s.decisionNotes}
                </p>
              )}
              {url && (
                <Link
                  href={url}
                  className="text-tb-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  Edit and resubmit
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </Link>
              )}
            </div>
          )}

          {s.status === 'DRAFT' && s.draftExpiresAt && (
            <p className="mt-1 text-xs text-gray-400">
              Auto-saved draft · expires{' '}
              {new Date(s.draftExpiresAt).toLocaleDateString('en-AU')}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}
        >
          {STATUS_LABEL[s.status]}
        </span>
      </div>
    </div>
  );
}
