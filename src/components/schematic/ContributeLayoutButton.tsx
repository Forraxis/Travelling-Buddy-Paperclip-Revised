'use client';

import { useState } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Closes the community-data flywheel: once an owner has dragged accessories into
 * place, they can contribute that layout. Positions land PENDING and, once a
 * moderator promotes the consensus, become the canonical default for every
 * future calculator. Shown only when there's something worth contributing.
 */
export default function ContributeLayoutButton() {
  const { state } = useCalculatorState();
  const [status, setStatus] = useState<Status>('idle');

  const positioned = state.accessories.filter(
    (a) => a.cogXMm != null && a.cogYMm != null,
  );
  if (!state.vehicleVariantId || positioned.length === 0) return null;

  async function contribute() {
    setStatus('sending');
    try {
      const res = await fetch('/api/fitments/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleVariantId: state.vehicleVariantId,
          source: 'calculator',
          items: positioned.map((a) => ({
            fitmentId: a.accessoryId,
            cogXMm: Math.round(a.cogXMm as number),
            cogYMm: Math.round(a.cogYMm as number),
          })),
        }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <p className="bg-tb-success/10 text-tb-success mt-2 rounded-md px-3 py-2 text-xs font-medium">
        Thanks! Your layout was submitted — once reviewed it helps everyone with
        this vehicle.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={contribute}
        disabled={status === 'sending'}
        className="border-tb-accent/40 bg-tb-accent/5 text-tb-accent hover:bg-tb-accent/10 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
      >
        {status === 'sending'
          ? 'Submitting…'
          : `Contribute this layout (${positioned.length})`}
      </button>
      {status === 'error' && (
        <span className="text-tb-danger ml-2 text-xs">
          Couldn’t submit — try again.
        </span>
      )}
      <p className="mt-1 text-[11px] text-gray-400">
        Share where you mounted these so we can build community-verified
        positions.
      </p>
    </div>
  );
}
