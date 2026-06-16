'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { SchematicModel } from './model';
import RigSchematic from './RigSchematic';
import TopDownSchematic from './TopDownSchematic';
import ContributeLayoutButton from './ContributeLayoutButton';
import { useCalculatorState } from '@/modules/calculator/context';

/** Side-profile + top-down (plan) views of the rig with a small toggle. */
export default function SchematicViewer({ model }: { model: SchematicModel }) {
  const [view, setView] = useState<'side' | 'top'>('side');
  const { setAccessoryPosition } = useCalculatorState();
  const searchParams = useSearchParams();

  // Deep-link to the full-screen layout planner for this rig. Carry the saved
  // setup if there is one (full fidelity), else seed the attached caravan.
  let plannerHref: string | null = null;
  if (model.vehicleSlug) {
    const params = new URLSearchParams();
    const setupId = searchParams.get('setupId');
    if (setupId) params.set('setupId', setupId);
    else if (model.caravanSlug) params.set('c', model.caravanSlug);
    const qs = params.toString();
    plannerHref = `/layout/${model.vehicleSlug}/${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="border-tb-neutral-200 inline-flex rounded-lg border bg-white p-0.5 text-xs font-semibold">
          {(['side', 'top'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 transition-colors ${
                view === v
                  ? 'bg-tb-primary text-white'
                  : 'hover:text-tb-primary text-gray-500'
              }`}
              aria-pressed={view === v}
            >
              {v === 'side' ? 'Side' : 'Top-down'}
            </button>
          ))}
        </div>
        {plannerHref && (
          <Link
            href={plannerHref}
            className="text-tb-primary hover:text-tb-primary-light inline-flex items-center gap-1 text-xs font-semibold"
          >
            Customise layout
            <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>

      {view === 'side' ? (
        <>
          <RigSchematic model={model} />
          <p className="mt-1.5 text-center text-[11px] text-gray-400">
            Switch to{' '}
            <button
              type="button"
              onClick={() => setView('top')}
              className="text-tb-primary hover:underline"
            >
              Top-down
            </button>{' '}
            to drag your gear into position.
          </p>
        </>
      ) : (
        <>
          <TopDownSchematic
            model={model}
            onMovePosition={setAccessoryPosition}
          />
          <ContributeLayoutButton />
        </>
      )}
    </div>
  );
}
