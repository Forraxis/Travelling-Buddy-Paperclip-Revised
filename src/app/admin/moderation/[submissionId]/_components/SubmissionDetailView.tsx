'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { SubmissionType } from '../../actions';
import {
  approveSubmission,
  rejectSubmission,
  editAndApproveSubmission,
} from '../../actions';
import type { VlmVerdict } from '../../_components/types';
import { verdictLabel } from '../../_components/types';

const VERDICT_COLORS: Record<string, string> = {
  AUTO_APPROVE: 'bg-green-100 text-green-700',
  QUEUE_FOR_REVIEW: 'bg-yellow-100 text-yellow-700',
  AUTO_REJECT: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-500',
};

const TRUST_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  BASIC: 'bg-blue-50 text-blue-600',
  TRUSTED: 'bg-green-50 text-green-700',
  EXPERT: 'bg-purple-50 text-purple-700',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  DEFERRED: 'bg-orange-100 text-orange-700',
  DRAFT: 'bg-gray-100 text-gray-500',
};

interface Props {
  id: string;
  type: SubmissionType;
  status: string;
  submittedData: Record<string, unknown>;
  photoUrls: string[];
  vlmGatekeeperResult: Record<string, unknown> | null;
  vlmExtractionResult: Record<string, unknown> | null;
  vlmVerdict: VlmVerdict;
  vlmSummary: string | null;
  entityName: string;
  submitter: {
    id: string;
    name: string | null;
    email: string | null;
    trustTier: string;
    memberSince: string;
  };
  decidedBy: { id: string; name: string | null } | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  dupSuspected: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-gray-50 py-2 last:border-0">
      <dt className="text-sm text-gray-500 capitalize">
        {label.replace(/_/g, ' ')}
      </dt>
      <dd className="col-span-2 text-sm text-gray-900">{String(value)}</dd>
    </div>
  );
}

function PhotoGallery({ urls }: { urls: string[] }) {
  const [selected, setSelected] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
        No photos
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="group relative h-64 w-full cursor-zoom-in overflow-hidden rounded-lg bg-gray-100">
        <Image
          src={urls[selected]}
          alt="submission photo"
          fill
          className="object-contain"
          unoptimized
        />
        <a
          href={urls[selected]}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-end justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <span className="rounded bg-black/50 px-2 py-1 text-xs text-white">
            View full
          </span>
        </a>
      </div>
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {urls.map((url, i) => (
            <button
              key={url}
              onClick={() => setSelected(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${i === selected ? 'border-tb-primary' : 'border-gray-200'}`}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VlmSection({
  verdict,
  summary,
  gatekeeperResult,
  extractionResult,
}: {
  verdict: VlmVerdict;
  summary: string | null;
  gatekeeperResult: Record<string, unknown> | null;
  extractionResult: Record<string, unknown> | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const verdictKey = verdict ?? 'none';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">VLM Assessment</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_COLORS[verdictKey] ?? VERDICT_COLORS.none}`}
        >
          {verdictLabel(verdict)}
        </span>
      </div>

      {summary && <p className="text-sm text-gray-600">{summary}</p>}

      {!gatekeeperResult && !extractionResult && (
        <p className="text-sm text-gray-400 italic">
          No VLM data available yet.
        </p>
      )}

      {(gatekeeperResult || extractionResult) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-tb-primary text-xs hover:underline"
        >
          {expanded ? 'Hide raw data ▲' : 'Show raw data ▼'}
        </button>
      )}

      {expanded && (
        <div className="space-y-3">
          {gatekeeperResult && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">
                Gatekeeper / Similarity Result
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-700">
                {JSON.stringify(gatekeeperResult, null, 2)}
              </pre>
            </div>
          )}
          {extractionResult && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">
                Extraction Result
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-700">
                {JSON.stringify(extractionResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RejectModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setBusy(true);
    await onSubmit(reason.trim());
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-base font-semibold">Reject Submission</h3>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          className="focus:ring-tb-primary w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          rows={4}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder="Explain why this submission is being rejected…"
          autoFocus
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
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
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditApproveModal({
  submittedData,
  onSubmit,
  onClose,
}: {
  submittedData: Record<string, unknown>;
  onSubmit: (edits: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const editableKeys = [
    'variantName',
    'year',
    'notes',
    'gvmKg',
    'gcmKg',
    'wheelbaseMm',
    'name',
    'fuelType',
    'transmission',
    'drivetrain',
  ];
  const initial: Record<string, string> = {};
  for (const k of editableKeys) {
    if (submittedData[k] !== undefined && submittedData[k] !== null) {
      initial[k] = String(submittedData[k]);
    }
  }

  const [fields, setFields] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const edits: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== String(submittedData[k] ?? '')) {
        edits[k] = v === '' ? null : v;
      }
    }
    await onSubmit(edits);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-base font-semibold">Edit and Approve</h3>
        <p className="mb-4 text-sm text-gray-500">
          Make minor corrections before approving. Only changed fields are
          saved.
        </p>
        <div className="space-y-3">
          {Object.entries(fields).map(([key, val]) => (
            <div key={key}>
              <label className="mb-0.5 block text-xs font-medium text-gray-600 capitalize">
                {key.replace(/_/g, ' ')}
              </label>
              <input
                className="focus:ring-tb-primary w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                value={val}
                onChange={(e) =>
                  setFields({ ...fields, [key]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
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
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save and Approve'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SubmissionDetailView({
  id,
  type,
  status,
  submittedData,
  photoUrls,
  vlmGatekeeperResult,
  vlmExtractionResult,
  vlmVerdict,
  vlmSummary,
  entityName,
  submitter,
  decidedBy,
  decidedAt,
  decisionNotes,
  createdAt,
  dupSuspected,
}: Props) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [showEditApprove, setShowEditApprove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = status === 'PENDING';

  async function handleApprove() {
    setBusy(true);
    setError(null);
    const result = await approveSubmission(id, type);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push('/admin/moderation');
    router.refresh();
  }

  async function handleReject(reason: string) {
    setError(null);
    const result = await rejectSubmission(id, type, reason);
    if (!result.success) {
      setError(result.error);
      setShowReject(false);
      return;
    }
    setShowReject(false);
    router.push('/admin/moderation');
    router.refresh();
  }

  async function handleEditApprove(edits: Record<string, unknown>) {
    setError(null);
    const result = await editAndApproveSubmission(id, type, edits);
    if (!result.success) {
      setError(result.error);
      setShowEditApprove(false);
      return;
    }
    setShowEditApprove(false);
    router.push('/admin/moderation');
    router.refresh();
  }

  const TYPE_COLORS: Record<SubmissionType, string> = {
    vehicle: 'bg-blue-100 text-blue-700',
    caravan: 'bg-purple-100 text-purple-700',
    accessory: 'bg-teal-100 text-teal-700',
  };

  return (
    <>
      {showReject && (
        <RejectModal
          onSubmit={handleReject}
          onClose={() => setShowReject(false)}
        />
      )}
      {showEditApprove && (
        <EditApproveModal
          submittedData={submittedData}
          onSubmit={handleEditApprove}
          onClose={() => setShowEditApprove(false)}
        />
      )}

      <div className="max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/moderation"
              className="hover:text-tb-primary mb-2 block text-xs text-gray-500"
            >
              ← Back to queue
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}
              >
                {type}
              </span>
              <h1 className="text-xl font-semibold text-gray-900">
                {entityName}
              </h1>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Submitted {formatDate(createdAt)}
            </p>
            {dupSuspected && (
              <span className="mt-1 inline-block rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                Submitter flagged as possible duplicate
              </span>
            )}
          </div>

          {isPending && (
            <div className="flex flex-shrink-0 items-center gap-2">
              {error && <span className="text-xs text-red-600">{error}</span>}
              <button
                onClick={handleApprove}
                disabled={busy}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {busy ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowEditApprove(true)}
                className="rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                Edit & Approve
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          )}
        </div>

        {!isPending && decidedBy && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${status === 'APPROVED' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
          >
            <strong>{status === 'APPROVED' ? 'Approved' : 'Rejected'}</strong>{' '}
            by {decidedBy.name ?? decidedBy.id} on{' '}
            {decidedAt ? formatDate(decidedAt) : 'unknown date'}
            {decisionNotes && (
              <p className="mt-1 text-gray-700">{decisionNotes}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Photos
              </h3>
              <PhotoGallery urls={photoUrls} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Submitter
              </h3>
              <dl className="space-y-1">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Name</dt>
                  <dd className="text-sm text-gray-900">
                    {submitter.name ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">
                    {submitter.email ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Trust tier</dt>
                  <dd>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${TRUST_COLORS[submitter.trustTier] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {submitter.trustTier}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Member since</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDate(submitter.memberSince)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="space-y-4">
            <VlmSection
              verdict={vlmVerdict}
              summary={vlmSummary}
              gatekeeperResult={vlmGatekeeperResult}
              extractionResult={vlmExtractionResult}
            />

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Submitted Fields
              </h3>
              <dl>
                {Object.entries(submittedData).map(([key, value]) => (
                  <FieldRow key={key} label={key} value={value} />
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
