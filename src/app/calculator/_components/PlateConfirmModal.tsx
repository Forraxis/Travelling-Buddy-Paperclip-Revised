'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlateConfirmedLimits } from '@/modules/calculator/types';

// ─────────────────────────────────────────────────────────────────────────────
// Compliance-plate confirmation (CATALOGUE_GRANULARITY_PLAN.md §6 — "plate = truth").
// Flow: photograph/upload the compliance plate → OCR (/api/ocr/compliance-plate)
// reads GVM/GCM → the user REVIEWS + edits the read (OCR can misread, so a human
// always confirms before it touches the verdict) → Apply writes a per-rig override
// that replaces the catalogue ESTIMATE and flips the limit to CONFIRMED.
// ─────────────────────────────────────────────────────────────────────────────

interface OcrResponse {
  extracted: { gvmKg?: number; gcmKg?: number; make?: string; year?: number };
  confidence: number;
}

interface PlateConfirmModalProps {
  onClose: () => void;
  /** Catalogue figures shown alongside the plate read for comparison. */
  catalogueGvmKg?: number | null;
  catalogueGcmKg?: number | null;
  /** An existing confirmation, when re-opening to edit/clear. */
  existing?: PlateConfirmedLimits | null;
  onApply: (plate: PlateConfirmedLimits) => void;
  onClear: () => void;
}

// Mounted only while open (parent gates with `{open && …}`), so state seeds from
// `existing` via useState initialisers — no set-state-in-effect to reset on open.
export function PlateConfirmModal({
  onClose,
  catalogueGvmKg,
  catalogueGcmKg,
  existing,
  onApply,
  onClear,
}: PlateConfirmModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [gvm, setGvm] = useState(() =>
    existing?.gvmKg != null ? String(existing.gvmKg) : '',
  );
  const [gcm, setGcm] = useState(() =>
    existing?.gcmKg != null ? String(existing.gcmKg) : '',
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    setOcrError(null);
    setConfidence(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/ocr/compliance-plate/', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('OCR failed');
      const data = (await res.json()) as OcrResponse;
      setConfidence(data.confidence ?? null);
      if (data.extracted.gvmKg) setGvm(String(data.extracted.gvmKg));
      if (data.extracted.gcmKg) setGcm(String(data.extracted.gcmKg));
      if (!data.extracted.gvmKg && !data.extracted.gcmKg) {
        setOcrError(
          "Couldn't read GVM/GCM from that photo — enter them from the plate below.",
        );
      }
    } catch {
      setOcrError(
        'Could not read the plate. Try a clearer photo, or enter the figures manually below.',
      );
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const gvmNum = gvm.trim() ? parseInt(gvm, 10) : null;
  const gcmNum = gcm.trim() ? parseInt(gcm, 10) : null;
  const gvmValid = gvmNum == null || (gvmNum >= 1000 && gvmNum <= 30000);
  const gcmValid = gcmNum == null || (gcmNum >= 1000 && gcmNum <= 50000);
  const canApply =
    (gvmNum != null || gcmNum != null) && gvmValid && gcmValid && !reading;

  function handleApply() {
    if (!canApply) return;
    onApply({
      gvmKg: gvmNum,
      gcmKg: gcmNum,
      capturedAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="border-tb-neutral-200 w-full max-w-md rounded-lg border bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm from your compliance plate"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Confirm from your compliance plate
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Catalogue figures are an estimate. Your compliance plate is the
              exact figure for your vehicle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Photo capture */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="border-tb-primary text-tb-primary hover:bg-tb-primary-lighter mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {reading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Reading plate…
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Photograph your compliance plate
            </>
          )}
        </button>

        {ocrError && <p className="mb-3 text-xs text-amber-600">{ocrError}</p>}
        {confidence != null && !ocrError && (
          <p className="mb-3 text-xs text-gray-400">
            Read from your photo ({Math.round(confidence)}% OCR confidence) —
            check the figures below match your plate.
          </p>
        )}

        {/* Editable figures, with the catalogue estimate alongside */}
        <div className="space-y-3">
          <PlateField
            label="GVM (kg)"
            sub="Gross Vehicle Mass"
            value={gvm}
            onChange={setGvm}
            catalogue={catalogueGvmKg}
            invalid={!gvmValid}
          />
          <PlateField
            label="GCM (kg)"
            sub="Gross Combination Mass"
            value={gcm}
            onChange={setGcm}
            catalogue={catalogueGcmKg}
            invalid={!gcmValid}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {existing ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="text-xs font-medium text-gray-500 hover:text-red-600 hover:underline"
            >
              Remove plate figures
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border-tb-neutral-200 rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className="bg-tb-primary hover:bg-tb-primary-dark rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply to my calculation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlateField({
  label,
  sub,
  value,
  onChange,
  catalogue,
  invalid,
}: {
  label: string;
  sub: string;
  value: string;
  onChange: (v: string) => void;
  catalogue?: number | null;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <span className="ml-1 text-[10px] text-gray-400">{sub}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={catalogue != null ? String(catalogue) : '—'}
          className={`w-32 rounded-md border px-2 py-1.5 text-sm tabular-nums ${
            invalid
              ? 'border-red-400 focus:ring-red-400'
              : 'border-tb-neutral-200 focus:ring-tb-primary'
          } focus:ring-1 focus:outline-none`}
        />
        {catalogue != null && (
          <span className="text-[10px] text-gray-400">
            catalogue estimate: {catalogue.toLocaleString()} kg
          </span>
        )}
      </div>
    </label>
  );
}
