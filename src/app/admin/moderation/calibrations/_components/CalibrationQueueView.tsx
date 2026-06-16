'use client';

import { useState, useTransition } from 'react';
import type { CorrectionAggregate } from '@/lib/physics/calibration-contribution';
import {
  approveCalibrationContributions,
  rejectCalibrationContributions,
} from '../actions';

export interface CalibrationRow {
  id: string;
  granularity: string;
  measuredTotalKg: number;
  predictedTotalKg: number;
  residualMassKg: number;
  barenessWeight: number;
  kerbMassDeltaKg: number | null;
  cogFractionDelta: number | null;
}

export interface CalibrationGroup {
  vehicleVariantId: string;
  variantName: string;
  minSamples: number;
  rows: CalibrationRow[];
  aggregate: CorrectionAggregate;
}

function fmtKg(n: number | null): string {
  return n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(0)} kg`;
}
function fmtFrac(n: number | null): string {
  return n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(3)}`;
}

export function CalibrationQueueView({ groups }: { groups: CalibrationGroup[] }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(groups);
  const [applyCog, setApplyCog] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function remove(id: string) {
    setRows((r) => r.filter((g) => g.vehicleVariantId !== id));
  }

  function onApprove(g: CalibrationGroup) {
    setError(null);
    startTransition(async () => {
      const res = await approveCalibrationContributions(
        g.vehicleVariantId,
        applyCog[g.vehicleVariantId] ?? false,
      );
      if (res.success) remove(g.vehicleVariantId);
      else setError(res.error);
    });
  }

  function onReject(g: CalibrationGroup) {
    setError(null);
    startTransition(async () => {
      const res = await rejectCalibrationContributions(g.vehicleVariantId);
      if (res.success) remove(g.vehicleVariantId);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Calibration contribution queue
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Owners who weighed their rig and shared the ticket. Approving publishes
          a bareness-weighted per-model correction. The kerb-MASS delta applies
          automatically once it clears the sample gate; the kerb-CoG-FRACTION
          delta stays gated behind the checkbox — the Rule-11 sign-off — because
          the “everyone loads the back” confound needs a human eye.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          No pending calibration contributions. 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((g) => {
            const a = g.aggregate;
            const massReady = a.kerbMassSampleCount >= g.minSamples;
            const cogReady = a.cogSampleCount >= g.minSamples;
            return (
              <li
                key={g.vehicleVariantId}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{g.variantName}</p>
                    <p className="text-sm text-gray-500">
                      {g.rows.length} pending contribution
                      {g.rows.length === 1 ? '' : 's'}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                      <span className="text-gray-700">
                        Kerb-mass Δ (weighted median):{' '}
                        <span className="font-mono font-semibold">
                          {fmtKg(a.kerbMassDeltaKg)}
                        </span>
                        <span
                          className={`ml-1 text-xs ${massReady ? 'text-green-600' : 'text-amber-600'}`}
                        >
                          {a.kerbMassSampleCount}/{g.minSamples}
                          {massReady ? ' ✓' : ' (gate)'}
                        </span>
                      </span>
                      <span className="text-gray-700">
                        CoG-fraction Δ:{' '}
                        <span className="font-mono font-semibold">
                          {fmtFrac(a.cogFractionDelta)}
                        </span>
                        <span
                          className={`ml-1 text-xs ${cogReady ? 'text-green-600' : 'text-amber-600'}`}
                        >
                          {a.cogSampleCount}/{g.minSamples}
                          {cogReady ? ' ✓' : ' (gate)'}
                        </span>
                      </span>
                    </div>

                    <details className="mt-2 text-xs text-gray-500">
                      <summary className="cursor-pointer select-none">
                        Per-contribution rows
                      </summary>
                      <table className="mt-1 w-full max-w-xl tabular-nums">
                        <thead className="text-left text-gray-400">
                          <tr>
                            <th className="pr-3 font-normal">Ticket</th>
                            <th className="pr-3 font-normal">Meas/Pred</th>
                            <th className="pr-3 font-normal">Residual</th>
                            <th className="pr-3 font-normal">Bareness</th>
                            <th className="pr-3 font-normal">CoG Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r) => (
                            <tr key={r.id} className="text-gray-600">
                              <td className="pr-3">{r.granularity}</td>
                              <td className="pr-3 font-mono">
                                {r.measuredTotalKg.toFixed(0)}/
                                {r.predictedTotalKg.toFixed(0)}
                              </td>
                              <td className="pr-3 font-mono">
                                {fmtKg(r.residualMassKg)}
                              </td>
                              <td className="pr-3 font-mono">
                                {r.barenessWeight.toFixed(2)}
                              </td>
                              <td className="pr-3 font-mono">
                                {fmtFrac(r.cogFractionDelta)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={applyCog[g.vehicleVariantId] ?? false}
                        disabled={!cogReady}
                        onChange={(e) =>
                          setApplyCog((s) => ({
                            ...s,
                            [g.vehicleVariantId]: e.target.checked,
                          }))
                        }
                      />
                      Apply CoG shift (sign-off)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onReject(g)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onApprove(g)}
                        className="rounded-md bg-tb-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-tb-primary/90 disabled:opacity-50"
                      >
                        Publish correction
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
