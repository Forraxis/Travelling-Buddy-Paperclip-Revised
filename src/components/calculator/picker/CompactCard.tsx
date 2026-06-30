'use client';

import type { PickerVariant, PickerConfig } from './types';
import { displayYearSpan, variantHeading } from './display';

// Non-breaking spaces inside each chip keep "1,945 kg" together; wrapping then
// only happens at the " · " separators, never mid-figure.
function chip(label: string, value: string) {
  return `${label} ${value} kg`;
}

function specLine(v: PickerVariant) {
  if (v.entityType === 'vehicle') {
    return [
      v.gvmKg && chip('GVM', v.gvmKg.toLocaleString()),
      v.maxTowingCapacityKg &&
        chip('Tow', v.maxTowingCapacityKg.toLocaleString()),
      v.kerbWeightKg && chip('Kerb', v.kerbWeightKg.toLocaleString()),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    v.atmKg && chip('ATM', v.atmKg.toLocaleString()),
    v.tbmKg && chip('TBM', String(v.tbmKg)),
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
     * vertically when a selection lands (spec §7.5). On mobile, allow the card
     * to grow to fit the full vehicle name and spec line without truncation.
     */
    <div className="border-tb-neutral-200 flex min-h-20 items-center gap-3 rounded-lg border bg-white px-4 md:h-20">
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
        <p className="text-sm font-semibold text-gray-900 md:truncate">
          {variantHeading(variant)}
        </p>
        <p className="text-xs text-gray-500">{displayYearSpan(variant)}</p>
        {specLine(variant) && (
          <p className="text-xs text-gray-400 md:truncate">
            {specLine(variant)}
          </p>
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
