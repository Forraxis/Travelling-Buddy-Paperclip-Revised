'use client';

import { useState } from 'react';
import type { SchematicModel } from './model';
import RigSchematic from './RigSchematic';
import TopDownSchematic from './TopDownSchematic';
import { useCalculatorState } from '@/modules/calculator/context';

/** Side-profile + top-down (plan) views of the rig with a small toggle. */
export default function SchematicViewer({ model }: { model: SchematicModel }) {
  const [view, setView] = useState<'side' | 'top'>('side');
  const { setAccessoryPosition } = useCalculatorState();
  return (
    <div className="mb-4">
      <div className="border-tb-neutral-200 mb-2 inline-flex rounded-lg border bg-white p-0.5 text-xs font-semibold">
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
      {view === 'side' ? (
        <RigSchematic model={model} />
      ) : (
        <TopDownSchematic model={model} onMovePosition={setAccessoryPosition} />
      )}
    </div>
  );
}
