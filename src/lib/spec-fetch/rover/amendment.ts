/**
 * Figure-level amendment detection for ROVER RVDs.
 *
 * Most ROVER re-issues are administrative — the file hash changes but the masses
 * we actually catalogue do not (the corpus Patrol/Navara/RAM amendment pairs all
 * keep their GVM, and two of three keep every mapped figure). The archive versions
 * every hash, but we only want to CHURN candidates / flag for re-review when a
 * figure we use actually moved. This module is that discriminator.
 *
 * Policy (matches VEHICLE_DATA_FETCH.md decision 3): compare per-variant MAPPED
 * figures (the ones `roverVariantFields` projects: GVM, GCM, braked towing, tare,
 * wheelbase, length) by variant NAME.
 *  - A variant present in both versions whose mapped figures differ → FIGURE_CHANGED.
 *  - A variant that only appears in one version (a RENAME — the Patrol re-labelled
 *    "Ti (Mid)" → "468") is administrative, NOT a figure change: we can't claim a
 *    tracked figure moved when the variant identity itself changed. So a pure
 *    re-label classifies as NO_FIGURE_CHANGE.
 *
 * Pure (docs in → diff out): no DB, trivially testable against the real corpus.
 */
import type { RvdDocument } from './rvd-parser';
import { roverVariantFields } from './variant-fields';

export type RvdFigureChangeStatus = 'NO_FIGURE_CHANGE' | 'FIGURE_CHANGED';

export interface RvdFigureChange {
  /** Variant name (the match key — same name in both versions). */
  variant: string;
  /** Canonical candidate field key, e.g. "kerbWeightKg". */
  field: string;
  from: string | null;
  to: string | null;
}

export interface RvdFigureDiff {
  status: RvdFigureChangeStatus;
  changes: RvdFigureChange[];
}

/**
 * Diff the mapped figures of two RVD versions of the same VTA. Only variants
 * matched by name are compared; renamed/added/removed variants don't register as
 * figure changes (see module note).
 */
export function diffRvdFigures(
  prev: RvdDocument,
  next: RvdDocument,
): RvdFigureDiff {
  const prevByName = new Map(prev.variants.map((v) => [v.name, v]));
  const changes: RvdFigureChange[] = [];

  for (const nextVariant of next.variants) {
    const prevVariant = prevByName.get(nextVariant.name);
    if (!prevVariant) continue; // new or renamed → administrative, not a figure move

    const prevFigures = new Map(
      roverVariantFields(prevVariant).map((f) => [f.field, f.value]),
    );
    for (const f of roverVariantFields(nextVariant)) {
      const from = prevFigures.get(f.field) ?? null;
      if (from !== f.value) {
        changes.push({
          variant: nextVariant.name,
          field: f.field,
          from,
          to: f.value,
        });
      }
    }
  }

  return {
    status: changes.length > 0 ? 'FIGURE_CHANGED' : 'NO_FIGURE_CHANGE',
    changes,
  };
}
