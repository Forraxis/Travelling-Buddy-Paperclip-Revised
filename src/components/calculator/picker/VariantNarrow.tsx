'use client';

import { useState, useEffect } from 'react';
import type { PickerVariant, EntityType } from './types';
import { variantTitle } from './display';
import { OriginTag } from './OriginTag';
import {
  stepsFor,
  computeFlow,
  optionsFor,
  applySelections,
  splitLeaf,
  stepGatedOut,
  type Selections,
  type FacetStep,
} from './facet-steps';

// ─────────────────────────────────────────────────────────────────────────────
// The guided variant narrow-down. Phone (narrow): a stepper — one facet decision
// per screen with counts + breadcrumb + auto-skip. Desktop (wide): the same facets
// as labelled dropdowns over a live-refining list. Both end on the same leaf rows.
// ─────────────────────────────────────────────────────────────────────────────

function useIsWide(breakpoint = 768): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpoint]);
  return wide;
}

function specLine(v: PickerVariant): string {
  if (v.entityType === 'vehicle') {
    return [
      v.gvmKg && `GVM ${v.gvmKg.toLocaleString()} kg`,
      v.maxTowingCapacityKg &&
        `Tow ${v.maxTowingCapacityKg.toLocaleString()} kg`,
      v.kerbWeightKg && `Kerb ${v.kerbWeightKg.toLocaleString()} kg`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    v.atmKg && `ATM ${v.atmKg.toLocaleString()} kg`,
    v.tbmKg && `TBM ${v.tbmKg} kg`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function yearText(v: PickerVariant): string {
  return v.isCurrentProduction
    ? `${v.yearFrom}–present`
    : v.yearFrom === v.yearTo
      ? `${v.yearFrom}`
      : `${v.yearFrom}–${v.yearTo}`;
}

// ── Leaf rows (shared) ──────────────────────────────────────────────────────

function LeafRow({
  v,
  onSelect,
}: {
  v: PickerVariant;
  onSelect: (v: PickerVariant) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(v)}
      className="hover:bg-tb-neutral-50 flex w-full flex-col rounded px-3 py-2.5 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-900">
          {variantTitle(v)}
          <OriginTag code={v.buildOrigin} />
        </span>
        <span className="flex-none text-xs text-gray-500">{yearText(v)}</span>
      </div>
      {specLine(v) && (
        <span className="mt-0.5 text-xs text-gray-400">{specLine(v)}</span>
      )}
    </button>
  );
}

function LeafList({
  variants,
  onSelect,
}: {
  variants: PickerVariant[];
  onSelect: (v: PickerVariant) => void;
}) {
  const { clean, other } = splitLeaf(variants);
  const [showOther, setShowOther] = useState(false);
  if (variants.length === 0)
    return (
      <p className="px-3 py-6 text-center text-sm text-gray-400">
        No matching configurations.
      </p>
    );
  return (
    <div className="divide-tb-neutral-200 divide-y px-2">
      {clean.map((v) => (
        <LeafRow key={v.id} v={v} onSelect={onSelect} />
      ))}
      {other.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOther((s) => !s)}
            className="hover:bg-tb-neutral-50 flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-medium text-gray-500">
              Other configurations
            </span>
            <span className="text-[10px] text-gray-400">
              {other.length} {showOther ? '▲' : '▼'}
            </span>
          </button>
          {showOther &&
            other.map((v) => <LeafRow key={v.id} v={v} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

// ── Breadcrumb of resolved selections ────────────────────────────────────────

function Crumbs({
  resolved,
  onClear,
}: {
  resolved: { step: FacetStep; label: string }[];
  onClear: (key: string) => void;
}) {
  if (resolved.length === 0) return null;
  return (
    <div className="scrollbar-none flex flex-wrap gap-1.5 px-4 pt-1 pb-2">
      {resolved.map((r) => (
        <button
          key={r.step.key}
          type="button"
          onClick={() => onClear(r.step.key)}
          className="border-tb-primary bg-tb-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          title={`Change ${r.step.label}`}
        >
          {r.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface VariantNarrowProps {
  variants: PickerVariant[];
  entity: EntityType;
  onSelect: (v: PickerVariant) => void;
}

export function VariantNarrow({
  variants,
  entity,
  onSelect,
}: VariantNarrowProps) {
  const wide = useIsWide();
  const steps = stepsFor(entity);
  const [selections, setSelections] = useState<Selections>({});

  const pick = (key: string, value: string) =>
    setSelections((s) => ({ ...s, [key]: value }));
  const clear = (key: string) =>
    setSelections((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });

  const flow = computeFlow(variants, steps, selections);

  // ── Desktop: labelled dropdowns + live list ──
  if (wide) {
    return (
      <div>
        <div className="flex flex-wrap gap-2 px-4 pt-1 pb-3">
          {steps.map((step) => {
            // Options valid given the OTHER selections (cascading).
            const rest = { ...selections };
            delete rest[step.key];
            const set = applySelections(variants, steps, rest);
            // Gated step (origin) hides until the set is fully tagged — the leaf
            // rows' flag pills disambiguate while data is still partial.
            if (stepGatedOut(step, set)) return null;
            const opts = optionsFor(step, set);
            if (opts.length === 0) return null;
            return (
              <label key={step.key} className="flex flex-col">
                <span className="mb-0.5 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                  {step.label}
                </span>
                <select
                  value={selections[step.key] ?? ''}
                  onChange={(e) =>
                    e.target.value
                      ? pick(step.key, e.target.value)
                      : clear(step.key)
                  }
                  className="border-tb-neutral-200 focus:border-tb-primary-light rounded-md border bg-white px-2 py-1.5 text-xs text-gray-700 outline-none"
                >
                  <option value="">Any</option>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.count})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <LeafList variants={flow.filtered} onSelect={onSelect} />
      </div>
    );
  }

  // ── Mobile: guided stepper ──
  return (
    <div>
      <Crumbs resolved={flow.resolved} onClear={clear} />
      {flow.activeStep ? (
        <div className="px-2">
          <p className="px-3 pt-1 pb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
            {flow.activeStep.label}
          </p>
          {flow.activeOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(flow.activeStep!.key, o.value)}
              className="hover:bg-tb-neutral-50 flex w-full items-center justify-between rounded px-3 py-3 text-left transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">
                {o.label}
              </span>
              <span className="flex items-center gap-2 text-xs text-gray-400">
                {o.count}
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <LeafList variants={flow.filtered} onSelect={onSelect} />
      )}
    </div>
  );
}
