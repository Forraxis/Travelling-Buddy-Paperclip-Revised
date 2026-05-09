'use client';

import type { PickerVariant, PickerConfig } from './types';

function yearSpan(v: PickerVariant) {
  return v.isCurrentProduction ? `${v.yearFrom}–present` : `${v.yearFrom}–${v.yearTo}`;
}

function specLine(v: PickerVariant) {
  if (v.entityType === 'vehicle') {
    return [
      v.gvmKg && `GVM ${v.gvmKg.toLocaleString()} kg`,
      v.maxTowingCapacityKg && `Tow ${v.maxTowingCapacityKg.toLocaleString()} kg`,
      v.kerbWeightKg && `Kerb ${v.kerbWeightKg.toLocaleString()} kg`,
    ].filter(Boolean).join(' · ');
  }
  return [
    v.atmKg && `ATM ${v.atmKg.toLocaleString()} kg`,
    v.tbmKg && `TBM ${v.tbmKg} kg`,
  ].filter(Boolean).join(' · ');
}

interface CompactCardProps {
  variant: PickerVariant;
  config: PickerConfig;
  onChange: () => void;
}

export function CompactCard({ variant, config, onChange }: CompactCardProps) {
  return (
    /*
     * ~80px height mirrors the empty-state card so the panel does not reflow
     * vertically when a selection lands (spec §7.5).
     */
    <div className="flex h-20 items-center gap-3 rounded-lg border border-tb-neutral-200 bg-white px-4">
      {/* Make logo / silhouette */}
      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-tb-neutral-50 text-sm font-bold uppercase text-tb-primary">
        {variant.makeLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={variant.makeLogoUrl} alt={variant.makeName} className="h-10 w-10 object-contain" />
        ) : (
          variant.makeName.slice(0, 2)
        )}
      </div>

      {/* Title + spec strip */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {variant.makeName} {variant.modelName} {variant.name}
        </p>
        <p className="text-xs text-gray-500">{yearSpan(variant)}</p>
        {specLine(variant) && (
          <p className="truncate text-xs text-gray-400">{specLine(variant)}</p>
        )}
      </div>

      {/* Change link */}
      <button
        type="button"
        onClick={onChange}
        className="flex-none text-xs font-medium text-tb-primary-light underline-offset-2 hover:underline"
        aria-label={`Change ${config.label}`}
      >
        Change
      </button>
    </div>
  );
}
