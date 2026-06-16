'use client';

import { useState, useTransition } from 'react';
import type {
  PositionAggregate,
  PositionSample,
} from '@/lib/fitment-positions';
import { approveFitmentPositions, rejectFitmentPositions } from '../actions';

export interface PositionGroup {
  key: {
    fitmentId: string;
    vehicleVariantId: string | null;
    caravanVariantId: string | null;
  };
  accessoryName: string;
  mountingLocation: string;
  variantName: string;
  canonical: { cogXMm: number; cogYMm: number } | null;
  samples: PositionSample[];
  consensus: PositionAggregate;
}

export function PositionQueueView({ groups }: { groups: PositionGroup[] }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(groups);
  const [error, setError] = useState<string | null>(null);

  function remove(fitmentId: string, vId: string | null, cId: string | null) {
    setRows((r) =>
      r.filter(
        (g) =>
          !(
            g.key.fitmentId === fitmentId &&
            g.key.vehicleVariantId === vId &&
            g.key.caravanVariantId === cId
          ),
      ),
    );
  }

  function onApprove(g: PositionGroup) {
    setError(null);
    startTransition(async () => {
      const res = await approveFitmentPositions(g.key);
      if (res.success) {
        remove(g.key.fitmentId, g.key.vehicleVariantId, g.key.caravanVariantId);
      } else {
        setError(res.error);
      }
    });
  }

  function onReject(g: PositionGroup) {
    setError(null);
    startTransition(async () => {
      const res = await rejectFitmentPositions(g.key);
      if (res.success) {
        remove(g.key.fitmentId, g.key.vehicleVariantId, g.key.caravanVariantId);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Community position queue
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Owners who dragged an accessory into place on their rig. Approving
          promotes the median position to the canonical fitment — every future
          calculator inherits it.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          No pending position contributions. 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((g) => {
            const k = `${g.key.fitmentId}|${g.key.vehicleVariantId ?? ''}|${g.key.caravanVariantId ?? ''}`;
            const shift = g.canonical
              ? Math.round(
                  Math.hypot(
                    g.consensus.cogXMm - g.canonical.cogXMm,
                    g.consensus.cogYMm - g.canonical.cogYMm,
                  ),
                )
              : null;
            return (
              <li
                key={k}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {g.accessoryName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {g.variantName} · {g.mountingLocation}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-gray-700">
                        <span className="font-semibold tabular-nums">
                          {g.consensus.sampleCount}
                        </span>{' '}
                        contribution{g.consensus.sampleCount === 1 ? '' : 's'}
                      </span>
                      <span className="text-gray-700">
                        Consensus:{' '}
                        <span className="font-mono">
                          x {g.consensus.cogXMm} · y {g.consensus.cogYMm} mm
                        </span>
                      </span>
                      <span className="text-gray-500">
                        Canonical:{' '}
                        {g.canonical ? (
                          <span className="font-mono">
                            x {g.canonical.cogXMm} · y {g.canonical.cogYMm} mm
                          </span>
                        ) : (
                          <em>none yet</em>
                        )}
                        {shift != null && shift > 0 && (
                          <span className="ml-1 text-amber-600">
                            (Δ {shift} mm)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
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
                      className="bg-tb-primary hover:bg-tb-primary/90 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Promote consensus
                    </button>
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
