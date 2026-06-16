'use client';

import { useState } from 'react';
import {
  SILHOUETTES,
  AccessorySilhouette,
} from '@/components/schematic/silhouettes/registry';
import type { SilhouetteView } from '@/components/schematic/silhouettes/types';

const VIEWS: SilhouetteView[] = ['top', 'side', 'front', 'back'];

const TINTS: { label: string; value: string }[] = [
  { label: 'Ink', value: '#1b3a5c' },
  { label: 'Pass', value: '#16a34a' },
  { label: 'Warn', value: '#d97706' },
  { label: 'Fail', value: '#dc2626' },
];

// Demo aspect ratios (w×h px) — proves the silhouette stretches to real dims
// while strokes stay crisp.
const ASPECTS = [
  { label: 'Square', w: 120, h: 120 },
  { label: 'Wide', w: 180, h: 90 },
  { label: 'Tall', w: 90, h: 150 },
];

export function SilhouetteGallery() {
  const [tint, setTint] = useState('#1b3a5c');
  const [aspect, setAspect] = useState(ASPECTS[0]);
  const categories = Object.entries(SILHOUETTES);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Accessory silhouettes — proof set
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          The house visual language (ACCESSORY_ART.md). Vector, tintable by
          status, and stretched to real dimensions — strokes stay crisp via
          non-scaling-stroke. Review the art direction here before we fill the
          full multi-view library.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Tint</span>
          {TINTS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTint(t.value)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${tint === t.value ? 'border-gray-900' : 'border-gray-200'}`}
              style={{ color: t.value }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Aspect</span>
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setAspect(a)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${aspect.label === a.label ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-500'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(([key, cat]) => (
          <div
            key={key}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p className="mb-3 text-sm font-semibold text-gray-900">
              {cat.label}{' '}
              <span className="font-mono text-xs font-normal text-gray-400">
                {key}
              </span>
            </p>
            <div className="flex flex-wrap gap-5">
              {VIEWS.map((view) => {
                const has =
                  cat.views[view] || (view === 'back' && cat.views.front);
                return (
                  <div key={view} className="flex flex-col items-center gap-1">
                    <div
                      className="flex items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50"
                      style={{ width: aspect.w + 16, height: aspect.h + 16 }}
                    >
                      {has ? (
                        <AccessorySilhouette
                          category={key}
                          view={view}
                          width={aspect.w}
                          height={aspect.h}
                          tint={tint}
                          title={`${cat.label} — ${view}`}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300">
                          (box fallback)
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 capitalize">
                      {view}
                      {view === 'back' && cat.views.front && !cat.views.back
                        ? ' ↩'
                        : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
