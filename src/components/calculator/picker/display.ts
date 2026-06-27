import type { PickerVariant } from './types';
import { cleanVehicleName, looksCryptic } from '@/lib/catalogue/facet-tokens';

// Shared display helpers for picker rows / cards, so search, browse and the
// selected-rig card all format identically.

/**
 * Year range for display. Caps the upper bound at the CURRENT year — a variant
 * approved to 2031 reads "2021–2026" today and auto-rolls to "2021–2027" next
 * year (computed from the clock, no data change). Current-production keeps
 * "–present"; a single-year span collapses to just the year.
 */
export function displayYearSpan(v: PickerVariant): string {
  if (v.isCurrentProduction) return `${v.yearFrom}–present`;
  const now = new Date().getFullYear();
  const to = Math.min(v.yearTo, now);
  return v.yearFrom >= to ? `${v.yearFrom}` : `${v.yearFrom}–${to}`;
}

/** Clean per-variant label (composed facet name for vehicles; raw for caravans). */
export function variantTitle(v: PickerVariant): string {
  return v.entityType === 'vehicle'
    ? cleanVehicleName({
        name: v.name,
        badge: v.badge,
        cabType: v.cabType,
        driveType: v.driveType,
        transmission: v.transmission,
      })
    : v.name;
}

/**
 * Full heading for search results / the selected card. A caravan's variant name
 * already includes its model ("Discovery 2011 (17-55)"), so don't repeat the
 * model — just make + name. Vehicles compose make + model + the facet label.
 */
export function variantHeading(v: PickerVariant): string {
  if (v.entityType === 'caravan') return `${v.makeName} ${variantTitle(v)}`;
  // The composed/clean name sometimes repeats the model (model "HiLux", raw
  // name "Hilux (base)") → drop a leading model token so we don't read
  // "Toyota HiLux Hilux (base)".
  const modelRe = new RegExp(
    `^${v.modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*`,
    'i',
  );
  const title = variantTitle(v).replace(modelRe, '').trim();
  return [v.makeName, v.modelName, title].filter(Boolean).join(' ');
}

/**
 * A row whose display title is still a raw code (an un-named ROVER approval like
 * `GUN125R-BTFLXQ3` we couldn't compose a facet name for). These get demoted to
 * the bottom of lists so clean, human-named variants always lead.
 */
export function isCrypticRow(v: PickerVariant): boolean {
  return looksCryptic(variantTitle(v));
}

/** Sort comparator: clean rows first, then newest year, then title. */
export function byCleanThenYear(a: PickerVariant, b: PickerVariant): number {
  const ca = isCrypticRow(a) ? 1 : 0;
  const cb = isCrypticRow(b) ? 1 : 0;
  return (
    ca - cb ||
    b.yearFrom - a.yearFrom ||
    variantTitle(a).localeCompare(variantTitle(b))
  );
}
