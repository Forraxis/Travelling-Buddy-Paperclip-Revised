'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';
import {
  listVersions,
  createVersion,
  getVersion,
  deleteVersion,
  buildResultSummary,
  type SetupVersionDTO,
} from '@/modules/calculator/setup-versions';
import { VersionCompare } from './VersionCompare';

const ACCENT = '#0f766e'; // teal — distinct from calibration violet

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusDot(s: string): string {
  return s === 'fail'
    ? 'bg-red-500'
    : s === 'warn'
      ? 'bg-amber-400'
      : 'bg-green-500';
}

export function SetupVersionsPanel() {
  const { state, dispatch } = useCalculatorState();
  const view = usePhysicsView();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const setupId = searchParams.get('setupId');

  const [versions, setVersions] = useState<SetupVersionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setVersions(await listVersions(setupId));
    setLoading(false);
  }, [setupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const calibrated = !!state.calibration;

  const onSave = async () => {
    if (!setupId || !view) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    const created = await createVersion(setupId, {
      label: trimmed,
      note: note.trim() || undefined,
      stateSnapshot: state,
      resultSummary: buildResultSummary(view.result, calibrated),
      isWeighedBaseline: calibrated,
    });
    setSaving(false);
    if (created) {
      setVersions((prev) => [created, ...prev]);
      setLabel('');
      setNote('');
      setShowForm(false);
    }
  };

  const onRevert = async (v: SetupVersionDTO) => {
    if (!setupId) return;
    if (
      !window.confirm(
        `Revert to "${v.label}"? This replaces your current loads, positions and calibration.`,
      )
    )
      return;
    const full = await getVersion(setupId, v.id);
    if (full) dispatch({ type: 'LOAD_STATE', state: full.stateSnapshot });
  };

  const onDelete = async (v: SetupVersionDTO) => {
    if (!setupId) return;
    if (!window.confirm(`Delete version "${v.label}"?`)) return;
    if (await deleteVersion(setupId, v.id)) {
      setVersions((prev) => prev.filter((x) => x.id !== v.id));
      setSelected((prev) => prev.filter((id) => id !== v.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 2
          ? [prev[1], id]
          : [...prev, id],
    );
  };

  // ── Gate: needs a saved setup ──
  if (!setupId) {
    return (
      <section className="border-tb-neutral-200 bg-tb-neutral-50/40 rounded-lg border border-dashed p-3">
        <p className="text-xs font-medium text-gray-500">Versions</p>
        <p className="mt-1 text-[11px] text-gray-400">
          {session?.user
            ? 'Save this setup to capture named versions you can revert to and compare.'
            : 'Sign in and save this setup to capture versions.'}
        </p>
      </section>
    );
  }

  const compareVersions = versions.filter((v) => selected.includes(v.id));

  return (
    <section className="border-tb-neutral-200 rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">Versions</p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: ACCENT }}
        >
          {showForm ? 'Cancel' : '+ Save version'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 space-y-2 rounded-md border border-tb-neutral-200 bg-tb-neutral-50/50 p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={calibrated ? 'e.g. As weighed (Apr)' : 'e.g. Loaded for the trip'}
            maxLength={120}
            className="w-full rounded border border-tb-neutral-200 bg-white px-2 py-1 text-sm"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — what's different about this setup?"
            maxLength={1000}
            rows={2}
            className="w-full resize-none rounded border border-tb-neutral-200 bg-white px-2 py-1 text-xs"
          />
          {calibrated && (
            <p className="text-[11px] text-violet-600">
              This snapshot will be flagged as your weighbridge baseline.
            </p>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !label.trim()}
            className="w-full rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? 'Saving…' : 'Save version'}
          </button>
        </div>
      )}

      {compareVersions.length === 2 && (
        <VersionCompare
          a={compareVersions[0]}
          b={compareVersions[1]}
          onClose={() => setSelected([])}
        />
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-gray-400">
          No versions yet. Save one to snapshot this rig.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-tb-neutral-200 p-2.5"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(v.id)}
                  onChange={() => toggleSelect(v.id)}
                  className="mt-0.5"
                  style={{ accentColor: ACCENT }}
                  aria-label={`Select ${v.label} to compare`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {v.resultSummary && (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot(v.resultSummary.overallStatus)}`}
                      />
                    )}
                    <span className="truncate text-sm font-medium text-gray-800">
                      {v.label}
                    </span>
                    {v.isWeighedBaseline && (
                      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-violet-700 uppercase">
                        Weighed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {fmtDate(v.createdAt)}
                    {v.resultSummary &&
                      ` · GVM ${v.resultSummary.gvmKg} / ${v.resultSummary.gvmLimitKg} kg`}
                  </p>
                  {v.note && (
                    <p className="mt-1 text-xs text-gray-500">{v.note}</p>
                  )}
                  <div className="mt-1.5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => onRevert(v)}
                      className="text-xs font-medium"
                      style={{ color: ACCENT }}
                    >
                      Revert
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {versions.length >= 2 && compareVersions.length < 2 && (
        <p className="mt-2 text-[11px] text-gray-400">
          Tick two versions to compare them side-by-side.
        </p>
      )}
    </section>
  );
}
