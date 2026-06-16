'use client';

import type { SetupVersionDTO } from '@/modules/calculator/setup-versions';
import type { CalculatorState } from '@/modules/calculator/types';

interface Row {
  label: string;
  a?: number;
  b?: number;
  limit?: number;
}

function loadKeys(state: CalculatorState): Map<string, string> {
  // Map a stable key → display label for every load in a snapshot.
  const m = new Map<string, string>();
  for (const a of state.accessories ?? [])
    m.set(`acc:${a.accessoryId}`, a.label ?? 'Accessory');
  for (const a of state.caravanAccessories ?? [])
    m.set(`cvacc:${a.accessoryId}`, a.label ?? 'Caravan accessory');
  for (const l of state.customLoads ?? []) m.set(`load:${l.id}`, l.label);
  return m;
}

function diffLoads(a: CalculatorState, b: CalculatorState) {
  const ka = loadKeys(a);
  const kb = loadKeys(b);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [k, label] of kb) if (!ka.has(k)) added.push(label);
  for (const [k, label] of ka) if (!kb.has(k)) removed.push(label);
  return { added, removed };
}

export function VersionCompare({
  a,
  b,
  onClose,
}: {
  a: SetupVersionDTO;
  b: SetupVersionDTO;
  onClose: () => void;
}) {
  const sa = a.resultSummary;
  const sb = b.resultSummary;

  const rows: Row[] = [
    { label: 'GVM', a: sa?.gvmKg, b: sb?.gvmKg, limit: sa?.gvmLimitKg },
    {
      label: 'Front axle',
      a: sa?.frontAxleKg,
      b: sb?.frontAxleKg,
      limit: sa?.frontAxleLimitKg,
    },
    {
      label: 'Rear axle',
      a: sa?.rearAxleKg,
      b: sb?.rearAxleKg,
      limit: sa?.rearAxleLimitKg,
    },
  ];
  if (sa?.towBallKg != null || sb?.towBallKg != null)
    rows.push({ label: 'Tow ball', a: sa?.towBallKg, b: sb?.towBallKg });
  if (sa?.gcmKg != null || sb?.gcmKg != null)
    rows.push({
      label: 'GCM',
      a: sa?.gcmKg,
      b: sb?.gcmKg,
      limit: sa?.gcmLimitKg,
    });
  if (sa?.caravanAtmKg != null || sb?.caravanAtmKg != null)
    rows.push({
      label: 'Caravan ATM',
      a: sa?.caravanAtmKg,
      b: sb?.caravanAtmKg,
    });

  const { added, removed } = diffLoads(a.stateSnapshot, b.stateSnapshot);

  const cell = (val: number | undefined, limit?: number) => {
    if (val == null) return <span className="text-gray-300">—</span>;
    const over = limit != null && val > limit;
    return (
      <span className={over ? 'font-semibold text-red-600' : 'text-gray-800'}>
        {val}
      </span>
    );
  };

  return (
    <div className="mb-3 rounded-md border border-teal-200 bg-teal-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-teal-800">Compare</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-gray-400 hover:text-gray-600"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-xs tabular-nums">
        <span className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
          Metric
        </span>
        <span
          className="truncate text-right text-[10px] font-medium text-gray-500"
          title={a.label}
        >
          {a.label}
        </span>
        <span
          className="truncate text-right text-[10px] font-medium text-gray-500"
          title={b.label}
        >
          {b.label}
        </span>
        <span className="text-right text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
          Δ
        </span>
        {rows.map((r) => {
          const delta = r.a != null && r.b != null ? r.b - r.a : null;
          return (
            <div key={r.label} className="contents">
              <span className="border-t border-teal-100 py-1 text-gray-600">
                {r.label}
              </span>
              <span className="border-t border-teal-100 py-1 text-right">
                {cell(r.a, r.limit)}
              </span>
              <span className="border-t border-teal-100 py-1 text-right">
                {cell(r.b, r.limit)}
              </span>
              <span
                className={[
                  'border-t border-teal-100 py-1 text-right font-medium',
                  delta == null
                    ? 'text-gray-300'
                    : delta === 0
                      ? 'text-gray-400'
                      : delta > 0
                        ? 'text-amber-600'
                        : 'text-teal-600',
                ].join(' ')}
              >
                {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
              </span>
            </div>
          );
        })}
      </div>

      {(added.length > 0 || removed.length > 0) && (
        <div className="mt-2 border-t border-teal-100 pt-2 text-[11px]">
          {added.length > 0 && (
            <p className="text-teal-700">
              <span className="font-semibold">+ in {b.label}:</span>{' '}
              {added.join(', ')}
            </p>
          )}
          {removed.length > 0 && (
            <p className="text-gray-500">
              <span className="font-semibold">− vs {a.label}:</span>{' '}
              {removed.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
