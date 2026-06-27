'use client';

import { useState } from 'react';
import type { PhysicsResult } from '@/lib/physics/types';
import { useCalculatorState } from '@/modules/calculator/context';
import { PlateConfirmModal } from './PlateConfirmModal';

// ─────────────────────────────────────────────────────────────────────────────
// The "plate = truth" precision-path entry point (CATALOGUE_GRANULARITY_PLAN.md §6),
// shared by the desktop results column and the mobile results sheet. When the user
// confirms GVM/GCM from their compliance plate it replaces the catalogue ESTIMATE
// in the verdict and flips the limit to CONFIRMED (see build-physics-input.ts).
// ─────────────────────────────────────────────────────────────────────────────

export function PlateConfirmCTA({ result }: { result: PhysicsResult }) {
  const { state, setPlateConfirmed, clearPlateConfirmed } =
    useCalculatorState();
  const [open, setOpen] = useState(false);
  const plate = state.plateConfirmed ?? null;
  const confirmed = !!plate && (plate.gvmKg != null || plate.gcmKg != null);

  return (
    <div className="mb-4">
      {confirmed ? (
        <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-xs font-semibold text-green-800">
                Confirmed from your compliance plate
              </p>
              <p className="text-[10px] text-green-700">
                {[
                  plate.gvmKg != null &&
                    `GVM ${plate.gvmKg.toLocaleString()} kg`,
                  plate.gcmKg != null &&
                    `GCM ${plate.gcmKg.toLocaleString()} kg`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-green-700 hover:underline"
          >
            Edit
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-tb-primary-light text-tb-primary hover:bg-tb-primary-lighter flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
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
          Confirm GVM/GCM from your compliance plate
        </button>
      )}
      {open && (
        <PlateConfirmModal
          onClose={() => setOpen(false)}
          catalogueGvmKg={confirmed ? null : result.vehicle.gvmLimitKg}
          catalogueGcmKg={
            confirmed ? null : (result.vehicle.gcmLimitKg ?? null)
          }
          existing={plate}
          onApply={setPlateConfirmed}
          onClear={clearPlateConfirmed}
        />
      )}
    </div>
  );
}
