'use client';

import { useMemo, useState } from 'react';
import { calculate } from '@/lib/physics/engine';
import { calibrateToWeighbridge } from '@/lib/physics/weighbridge';
import type {
  WeighbridgeMeasurement,
  CalibrationGranularity,
} from '@/lib/physics/calibration';
import type { MetricStatus } from '@/lib/physics/types';
import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';

const ACCENT = '#7c3aed'; // violet — distinct from the blue water accent

const FIDELITIES: { key: CalibrationGranularity; label: string }[] = [
  { key: 'TOTAL', label: 'Total' },
  { key: 'AXLE', label: 'Per-axle' },
  { key: 'CORNER', label: 'Per-corner' },
];

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `wb-${crypto.randomUUID()}`;
  }
  return `wb-${Math.round(performance.now())}`;
}

function num(s: string): number | null {
  const v = parseFloat(s);
  return Number.isFinite(v) && v >= 0 ? v : null;
}

interface FieldProps {
  label: string;
  value: string;
  ghost?: number;
  onChange: (v: string) => void;
}

function Field({ label, value, ghost, onChange }: FieldProps) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="min-w-0 flex-1 text-xs text-gray-600">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="decimal"
          value={value}
          placeholder={ghost != null ? String(Math.round(ghost)) : '0'}
          onChange={(e) => onChange(e.target.value)}
          className="border-tb-neutral-200 focus:border-tb-primary-light focus:ring-tb-primary-light w-24 rounded border bg-white px-2 py-1 text-right text-xs text-gray-900 focus:ring-1 focus:outline-none"
          aria-label={label}
        />
        <span className="w-4 text-[11px] text-gray-400">kg</span>
      </span>
    </label>
  );
}

function statusMark(s: MetricStatus | undefined): string {
  if (s === 'fail') return ' ⚠ over';
  if (s === 'warn') return ' • close';
  return '';
}

/**
 * Weighbridge calibration entry + result. Anchors the rig to a measured ticket
 * and predicts only deltas (CALIBRATION_SIGNOFF.md). Client-side over
 * `calibrateToWeighbridge`; persistence rides the setup save flow. Used on both
 * the calculator and the layout editor (the unaccounted load is draggable there).
 */
export function WeighbridgeCalibrationPanel() {
  const { state, dispatch, addCustomLoad, removeCustomLoad } =
    useCalculatorState();
  const view = usePhysicsView();

  const [fidelity, setFidelity] = useState<CalibrationGranularity>('AXLE');
  const [total, setTotal] = useState('');
  const [front, setFront] = useState('');
  const [rear, setRear] = useState('');
  const [fl, setFl] = useState('');
  const [fr, setFr] = useState('');
  const [rl, setRl] = useState('');
  const [rr, setRr] = useState('');
  const [preferStaticOnly, setPreferStaticOnly] = useState(false);

  // The clean pre-calibration prediction P₀ — drives the ghost placeholders.
  const predicted = useMemo(() => {
    if (!view) return null;
    return calculate(view.baselineInput).vehicle;
  }, [view]);

  const cal = state.calibration;

  if (!view || !predicted) {
    return (
      <section className="border-tb-neutral-200 bg-tb-neutral-50/40 rounded-lg border border-dashed p-3">
        <p className="text-xs text-gray-400">
          Select a vehicle to calibrate against a weighbridge ticket.
        </p>
      </section>
    );
  }

  const buildMeasurement = (): WeighbridgeMeasurement | null => {
    if (fidelity === 'TOTAL') {
      const t = num(total);
      return t != null ? { granularity: 'TOTAL', totalKg: t } : null;
    }
    if (fidelity === 'AXLE') {
      const f = num(front);
      const r = num(rear);
      return f != null && r != null
        ? { granularity: 'AXLE', frontAxleKg: f, rearAxleKg: r }
        : null;
    }
    const c = { fl: num(fl), fr: num(fr), rl: num(rl), rr: num(rr) };
    return c.fl != null && c.fr != null && c.rl != null && c.rr != null
      ? {
          granularity: 'CORNER',
          corners: { fl: c.fl, fr: c.fr, rl: c.rl, rr: c.rr },
        }
      : null;
  };

  const apply = (
    measurement: WeighbridgeMeasurement,
    staticOnly: boolean,
  ) => {
    // Strip any prior unaccounted load so we re-solve against a clean C₀.
    if (cal?.unaccountedLoadId) removeCustomLoad(cal.unaccountedLoadId);

    const out = calibrateToWeighbridge(view.baselineInput, measurement, {
      preferStaticOnly: staticOnly,
    });

    let unaccountedLoadId: string | null = null;
    if (out.unaccountedLoad) {
      unaccountedLoadId = makeId();
      addCustomLoad({
        id: unaccountedLoadId,
        label: 'Unaccounted (weighbridge)',
        massKg: Math.round(out.unaccountedLoad.massKg),
        side: 'vehicle',
        cogXMm: out.unaccountedLoad.cogXMm,
        cogYMm: out.unaccountedLoad.cogYMm,
        isUnaccounted: true,
      });
    }

    dispatch({
      type: 'SET_CALIBRATION',
      calibration: {
        measurement,
        vehicleStaticOffsets: out.staticOffsets,
        unaccountedLoadId,
        notes: out.notes,
      },
    });
  };

  const onCalibrate = () => {
    const m = buildMeasurement();
    if (m) apply(m, preferStaticOnly);
  };

  const onToggleStatic = (next: boolean) => {
    setPreferStaticOnly(next);
    if (cal) apply(cal.measurement, next); // re-solve the stored ticket
  };

  const onClear = () => {
    dispatch({ type: 'CLEAR_CALIBRATION' });
    setTotal('');
    setFront('');
    setRear('');
    setFl('');
    setFr('');
    setRl('');
    setRr('');
    setPreferStaticOnly(false);
  };

  // ── Result view ──────────────────────────────────────────────────────────
  if (cal) {
    const calibrated = view.result.vehicle;
    const rows = [
      {
        k: 'Front axle',
        before: predicted.frontAxleKg,
        after: calibrated.frontAxleKg,
        status: calibrated.frontAxleStatus,
      },
      {
        k: 'Rear axle',
        before: predicted.rearAxleKg,
        after: calibrated.rearAxleKg,
        status: calibrated.rearAxleStatus,
      },
      {
        k: 'GVM (total)',
        before: predicted.totalWeightKg,
        after: calibrated.totalWeightKg,
        status: calibrated.gvmStatus,
      },
    ];
    return (
      <section className="border-tb-neutral-200 rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
            style={{ backgroundColor: ACCENT }}
          >
            Calibrated ✓
          </span>
          <p className="text-xs font-medium text-gray-500">
            Anchored to your weighbridge ticket
          </p>
        </div>

        {cal.notes.length > 0 && (
          <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
            {cal.notes.join(' ')}
          </p>
        )}

        <div className="mb-3 overflow-hidden rounded-md border border-tb-neutral-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-tb-neutral-50 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            <span>Metric</span>
            <span className="text-right">Model</span>
            <span className="text-right">Calibrated</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.k}
              className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-t border-tb-neutral-100 px-3 py-1.5 text-xs tabular-nums"
            >
              <span className="text-gray-600">{r.k}</span>
              <span className="text-right text-gray-400">
                {Math.round(r.before)}
              </span>
              <span
                className={[
                  'text-right font-medium',
                  r.status === 'fail'
                    ? 'text-red-600'
                    : r.status === 'warn'
                      ? 'text-amber-600'
                      : 'text-gray-900',
                ].join(' ')}
              >
                {Math.round(r.after)}
                {statusMark(r.status)}
              </span>
            </div>
          ))}
        </div>

        <label className="mb-3 flex cursor-pointer items-center gap-2 text-[11px] text-gray-500">
          <input
            type="checkbox"
            checked={preferStaticOnly}
            onChange={(e) => onToggleStatic(e.target.checked)}
            style={{ accentColor: ACCENT }}
          />
          I don&apos;t know where the extra weight sits (use a static correction)
        </label>

        <div className="flex gap-2 border-t border-tb-neutral-100 pt-3">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-400 transition-colors hover:text-red-500"
          >
            Clear calibration
          </button>
        </div>
      </section>
    );
  }

  // ── Entry view ───────────────────────────────────────────────────────────
  const canSubmit = buildMeasurement() != null;
  return (
    <section className="border-tb-neutral-200 rounded-lg border bg-white p-4">
      <p className="mb-1 text-xs font-medium text-gray-500">
        Weighbridge calibration
      </p>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-400">
        Weighed your rig? Enter the ticket and we&apos;ll anchor the numbers to
        reality, then predict only your changes.
      </p>

      <div className="mb-3 flex gap-1.5">
        {FIDELITIES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFidelity(f.key)}
            className={[
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              fidelity === f.key
                ? 'border-transparent text-white'
                : 'border-tb-neutral-200 bg-white text-gray-600 hover:text-gray-900',
            ].join(' ')}
            style={fidelity === f.key ? { backgroundColor: ACCENT } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 divide-y divide-tb-neutral-100">
        {fidelity === 'TOTAL' && (
          <Field
            label="Total / GVM"
            value={total}
            ghost={predicted.totalWeightKg}
            onChange={setTotal}
          />
        )}
        {fidelity === 'AXLE' && (
          <>
            <Field
              label="Front (steer) axle"
              value={front}
              ghost={predicted.frontAxleKg}
              onChange={setFront}
            />
            <Field
              label="Rear (drive) axle"
              value={rear}
              ghost={predicted.rearAxleKg}
              onChange={setRear}
            />
          </>
        )}
        {fidelity === 'CORNER' && (
          <>
            <Field
              label="Front-left"
              value={fl}
              ghost={predicted.lateral?.corners.fl}
              onChange={setFl}
            />
            <Field
              label="Front-right"
              value={fr}
              ghost={predicted.lateral?.corners.fr}
              onChange={setFr}
            />
            <Field
              label="Rear-left"
              value={rl}
              ghost={predicted.lateral?.corners.rl}
              onChange={setRl}
            />
            <Field
              label="Rear-right"
              value={rr}
              ghost={predicted.lateral?.corners.rr}
              onChange={setRr}
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onCalibrate}
        disabled={!canSubmit}
        className="w-full rounded-md px-3 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
      >
        Calibrate
      </button>
    </section>
  );
}
