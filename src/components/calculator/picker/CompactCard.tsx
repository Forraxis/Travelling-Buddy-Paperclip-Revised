'use client';

import type { PickerVariant, PickerConfig } from './types';
import { displayYearSpan, variantHeading } from './display';

function specLine(v: PickerVariant) {
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
    <div className="border-tb-neutral-200 flex h-20 items-center gap-3 rounded-lg border bg-white px-4">
      {/* Make logo / silhouette */}
      <div className="bg-tb-neutral-50 text-tb-primary flex h-12 w-12 flex-none items-center justify-center rounded-md text-sm font-bold uppercase">
        {variant.makeLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.makeLogoUrl}
            alt={variant.makeName}
            className="h-10 w-10 object-contain"
          />
        ) : (
          variant.makeName.slice(0, 2)
        )}
      </div>

      {/* Title + spec strip */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {variantHeading(variant)}
        </p>
        <p className="text-xs text-gray-500">{displayYearSpan(variant)}</p>
        {specLine(variant) && (
          <p className="truncate text-xs text-gray-400">{specLine(variant)}</p>
        )}
      </div>

      {/* Change link */}
      <button
        type="button"
        onClick={onChange}
        className="text-tb-primary-light flex-none text-xs font-medium underline-offset-2 hover:underline"
        aria-label={`Change ${config.label}`}
      >
        Change
      </button>
    </div>
  );
}
