import type { PickerVariant, EntityType } from './types';
import {
  bodyFeetHalf,
  formatFeet,
  formatOrigin,
} from '@/lib/catalogue/facet-tokens';
import { displayYearSpan, isCrypticRow } from './display';

// ─────────────────────────────────────────────────────────────────────────────
// Guided-narrow-down engine shared by the mobile stepper and the desktop
// filter-list. A model's variants are narrowed one facet at a time, in the order
// the user agreed (cars: cab→drive→year→grade · caravans: length→year→berths).
// Single-option steps auto-skip; un-narrowable OEM-code rows fall to "Other".
// ─────────────────────────────────────────────────────────────────────────────

export interface FacetStep {
  key: string;
  /** Step heading, e.g. "Cab", "Drive", "Length". */
  label: string;
  /** Discrete option value for a variant (null = this facet doesn't apply). */
  valueOf: (v: PickerVariant) => string | null;
  /** Human label for an option value. */
  display: (val: string) => string;
}

const CAB_LABEL: Record<string, string> = {
  SINGLE_CAB: 'Single Cab',
  KING_CAB: 'King Cab',
  DUAL_CAB: 'Dual Cab',
  WAGON: 'Wagon',
};
const DRIVE_LABEL: Record<string, string> = {
  FOUR_WHEEL_DRIVE: '4x4',
  TWO_WHEEL_DRIVE: '4x2',
  ALL_WHEEL_DRIVE: 'AWD',
};

const VEHICLE_STEPS: FacetStep[] = [
  {
    key: 'cab',
    label: 'Cab',
    valueOf: (v) => v.cabType ?? null,
    display: (val) => CAB_LABEL[val] ?? val,
  },
  {
    key: 'drive',
    label: 'Drive',
    valueOf: (v) => v.driveType ?? null,
    display: (val) => DRIVE_LABEL[val] ?? val,
  },
  {
    // Country of manufacture — only surfaces when a model-year was built in >1
    // plant with different specs (D40 Navara ES vs TH). Auto-hidden otherwise.
    key: 'origin',
    label: 'Origin',
    valueOf: (v) => v.buildOrigin ?? null,
    display: (val) => formatOrigin(val) ?? val,
  },
  {
    key: 'year',
    label: 'Year',
    // Generation when we have it, else the (clean, year-capped) span.
    valueOf: (v) => v.generation ?? displayYearSpan(v),
    display: (val) => val,
  },
  {
    key: 'grade',
    label: 'Grade',
    valueOf: (v) => v.badge ?? null,
    display: (val) => val,
  },
];

const CARAVAN_STEPS: FacetStep[] = [
  {
    key: 'length',
    label: 'Length',
    valueOf: (v) => {
      const ft = bodyFeetHalf(v.bodyLengthMm);
      return ft == null ? null : String(ft);
    },
    display: (val) => formatFeet(parseFloat(val)) ?? `${val} ft`,
  },
  {
    key: 'year',
    label: 'Year',
    valueOf: (v) => displayYearSpan(v),
    display: (val) => val,
  },
  {
    key: 'berths',
    label: 'Berths',
    valueOf: (v) => (v.berths == null ? null : String(v.berths)),
    display: (val) => `${val} berth`,
  },
];

export function stepsFor(entity: EntityType): FacetStep[] {
  return entity === 'vehicle' ? VEHICLE_STEPS : CARAVAN_STEPS;
}

export type Selections = Record<string, string>;

/** Distinct option values for a step among a set of variants, with counts. */
export function optionsFor(
  step: FacetStep,
  variants: PickerVariant[],
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of variants) {
    const val = step.valueOf(v);
    if (val == null || val === '') continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: step.display(value), count }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
}

/** Variants matching every current selection. */
export function applySelections(
  variants: PickerVariant[],
  steps: FacetStep[],
  selections: Selections,
): PickerVariant[] {
  return variants.filter((v) =>
    steps.every((s) => {
      const sel = selections[s.key];
      return sel === undefined || s.valueOf(v) === sel;
    }),
  );
}

export interface Flow {
  /** Variants left after applying the current selections. */
  filtered: PickerVariant[];
  /** The next step the user should decide (≥2 options), or null → show the leaf. */
  activeStep: FacetStep | null;
  activeOptions: { value: string; label: string; count: number }[];
  /** Steps already pinned to a single value (for the breadcrumb / dropdowns). */
  resolved: { step: FacetStep; value: string; label: string }[];
}

/**
 * Compute the guided-narrow state. Walks the steps in order; the first step with
 * ≥2 distinct options among the filtered set becomes active. Steps with exactly one
 * option are auto-resolved (no screen). When nothing is left to decide, activeStep
 * is null and the caller shows the leaf variant list.
 */
export function computeFlow(
  variants: PickerVariant[],
  steps: FacetStep[],
  selections: Selections,
): Flow {
  const filtered = applySelections(variants, steps, selections);
  const resolved: Flow['resolved'] = [];
  let activeStep: FacetStep | null = null;
  let activeOptions: Flow['activeOptions'] = [];

  for (const step of steps) {
    const opts = optionsFor(step, filtered);
    if (selections[step.key] !== undefined) {
      const sel = selections[step.key];
      resolved.push({ step, value: sel, label: step.display(sel) });
      continue;
    }
    if (opts.length >= 2) {
      activeStep = step;
      activeOptions = opts;
      break;
    }
    // 0 or 1 option → auto-skip (nothing for the user to decide here).
  }

  return { filtered, activeStep, activeOptions, resolved };
}

/** Split leaf variants into clean (named) vs "Other" (un-named OEM codes). */
export function splitLeaf(variants: PickerVariant[]): {
  clean: PickerVariant[];
  other: PickerVariant[];
} {
  const clean: PickerVariant[] = [];
  const other: PickerVariant[] = [];
  for (const v of variants) (isCrypticRow(v) ? other : clean).push(v);
  return { clean, other };
}
