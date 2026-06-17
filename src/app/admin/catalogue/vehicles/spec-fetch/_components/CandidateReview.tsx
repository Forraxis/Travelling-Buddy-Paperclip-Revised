'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { evaluatePromotionGate } from '@/lib/spec-fetch/gating';
import {
  clearCriticalOverride,
  promoteCandidate,
  rejectCandidate,
  setCriticalOverride,
  unpublishCandidate,
  updateCandidateField,
} from '../actions';

export interface FieldView {
  id: string;
  field: string;
  label: string;
  unit: string;
  value: string | null;
  confidence: string | null;
  sourceUrl: string | null;
  isComplianceCritical: boolean;
  adminValue: string | null;
  corroborated: boolean;
  notes: string | null;
}

export interface CandidateView {
  id: string;
  makeName: string;
  modelName: string;
  variantName: string | null;
  yearFrom: number;
  yearTo: number | null;
  provider: string;
  providerModel: string | null;
  status: string;
  hasOverride: boolean;
  overrideNote: string | null;
  overrideBy: string | null;
  overrideAt: string | null;
  resultingVariantId: string | null;
  resultingVariantName: string | null;
  decisionNotes: string | null;
  fields: FieldView[];
}

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-rose-100 text-rose-700',
};

export function CandidateReview({ candidate }: { candidate: CandidateView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [overrideNote, setOverrideNote] = useState('');
  // Local mirror so the gate banner updates immediately as the admin edits.
  const [fields, setFields] = useState(candidate.fields);

  const decided =
    candidate.status === 'APPROVED' || candidate.status === 'REJECTED';

  const gate = useMemo(
    () =>
      evaluatePromotionGate(
        fields.map((f) => ({
          field: f.field,
          value: f.value,
          adminValue: f.adminValue,
          corroborated: f.corroborated,
        })),
        candidate.hasOverride,
      ),
    [fields, candidate.hasOverride],
  );

  function patchLocal(id: string, patch: Partial<FieldView>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function saveField(
    f: FieldView,
    patch: {
      adminValue?: string | null;
      corroborated?: boolean;
      notes?: string | null;
    },
  ) {
    setError(null);
    startTransition(async () => {
      const res = await updateCandidateField(f.id, patch);
      if (!res.success) setError(res.error);
    });
  }

  function onPromote() {
    setError(null);
    startTransition(async () => {
      const res = await promoteCandidate(candidate.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onReject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectCandidate(candidate.id);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  function onSetOverride() {
    setError(null);
    if (!overrideNote.trim()) {
      setError('Enter a reason for the override.');
      return;
    }
    startTransition(async () => {
      const res = await setCriticalOverride(candidate.id, overrideNote.trim());
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  function onClearOverride() {
    startTransition(async () => {
      const res = await clearCriticalOverride(candidate.id);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  function onUnpublish() {
    startTransition(async () => {
      const res = await unpublishCandidate(candidate.id);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/catalogue/vehicles/spec-fetch"
        className="text-tb-primary text-sm hover:underline"
      >
        ← Back to candidates
      </Link>

      {/* Status + gate banner */}
      <div className="border-tb-neutral-200 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-gray-900">
            Status: {candidate.status}
          </span>
          <span className="text-gray-500">
            {candidate.provider}
            {candidate.providerModel ? ` (${candidate.providerModel})` : ''}
          </span>
          {candidate.resultingVariantId && (
            <span className="text-emerald-700">
              → promoted: {candidate.resultingVariantName}
            </span>
          )}
        </div>

        {!decided &&
          (gate.requiresOverride ? (
            gate.allowed ? (
              <p className="mt-3 rounded bg-purple-50 px-3 py-2 text-sm text-purple-800">
                Compliance-critical fields are uncorroborated, but an override
                is on file — promotion is allowed.
              </p>
            ) : (
              <p className="mt-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
                ⚠ Blocked: uncorroborated compliance-critical field(s):{' '}
                <span className="font-medium">
                  {gate.blockingFields.join(', ')}
                </span>
                . Corroborate each (tick the box) or record an override below.
              </p>
            )
          ) : (
            <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ All compliance-critical fields are corroborated or empty — ready
              to promote.
            </p>
          ))}

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {/* Per-field table */}
      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b text-gray-700">
              <th className="px-3 py-2.5 font-medium">Field</th>
              <th className="px-3 py-2.5 font-medium">Provider value</th>
              <th className="px-3 py-2.5 font-medium">Confidence</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium">Admin value</th>
              <th className="px-3 py-2.5 font-medium">Corroborated</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => {
              const isBlocking = gate.blockingFields.includes(f.field);
              return (
                <tr
                  key={f.id}
                  className={`border-tb-neutral-200 border-b last:border-0 ${
                    isBlocking ? 'bg-rose-50/40' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 text-gray-900">
                    {f.label}
                    {f.unit ? (
                      <span className="text-gray-400"> ({f.unit})</span>
                    ) : null}
                    {f.isComplianceCritical && (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        critical
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {f.value ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.confidence ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          CONFIDENCE_STYLES[f.confidence] ??
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {f.confidence}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {f.sourceUrl ? (
                      <a
                        href={f.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-tb-primary hover:underline"
                      >
                        source
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      disabled={decided || pending}
                      defaultValue={f.adminValue ?? ''}
                      placeholder={f.value ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (f.adminValue ?? null)) {
                          patchLocal(f.id, { adminValue: v });
                          saveField(f, { adminValue: v });
                        }
                      }}
                      className="border-tb-neutral-300 w-28 rounded border px-2 py-1 text-sm text-gray-900 disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      disabled={decided || pending}
                      checked={f.corroborated}
                      onChange={(e) => {
                        patchLocal(f.id, { corroborated: e.target.checked });
                        saveField(f, { corroborated: e.target.checked });
                      }}
                      className="h-4 w-4"
                      title={
                        f.isComplianceCritical
                          ? 'Corroborated against an authoritative source / plate — satisfies the gate.'
                          : 'Corroborated (optional for soft fields).'
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Override panel */}
      {!decided && (
        <div className="border-tb-neutral-200 rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Compliance-critical override
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Use only when you accept promoting an uncorroborated critical field
            (e.g. provisional data). Recorded against your account with a
            reason.
          </p>
          {candidate.hasOverride ? (
            <div className="mt-3 flex items-center justify-between rounded bg-purple-50 px-3 py-2 text-sm text-purple-800">
              <span>
                Override on file: “{candidate.overrideNote}”
                {candidate.overrideBy ? ` — ${candidate.overrideBy}` : ''}
              </span>
              <button
                onClick={onClearOverride}
                disabled={pending}
                className="text-purple-700 underline disabled:opacity-50"
              >
                clear
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="Reason for override…"
                className="border-tb-neutral-300 flex-1 rounded border px-2 py-1.5 text-sm text-gray-900"
              />
              <button
                onClick={onSetOverride}
                disabled={pending}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Record override
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {!decided && (
          <>
            <button
              onClick={onPromote}
              disabled={pending || !gate.allowed}
              title={
                gate.allowed
                  ? 'Promote to the public catalogue'
                  : 'Resolve the compliance gate first'
              }
              className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Promote to catalogue'}
            </button>
            <button
              onClick={onReject}
              disabled={pending}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {candidate.status === 'APPROVED' && candidate.resultingVariantId && (
          <button
            onClick={onUnpublish}
            disabled={pending}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Unpublish (return variant to non-public)
          </button>
        )}
      </div>
    </div>
  );
}
