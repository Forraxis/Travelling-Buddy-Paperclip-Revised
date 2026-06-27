'use client';

import type { PickerVariant } from './types';
import { bodyFeetHalf, formatFeet } from '@/lib/catalogue/facet-tokens';
import { displayYearSpan, variantHeading, isCrypticRow } from './display';
import { OriginTag } from './OriginTag';

const BADGE_CONFIG: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
  manufacturer_spec: { label: 'OEM Spec', cls: 'bg-blue-100 text-blue-700' },
  community: { label: 'Community', cls: 'bg-yellow-100 text-yellow-700' },
  estimated: { label: 'Estimated', cls: 'bg-gray-100 text-gray-500' },
};

function ConfidenceBadge({ badge }: { badge: string }) {
  const cfg = BADGE_CONFIG[badge] ?? BADGE_CONFIG.estimated;
  return (
    <span
      className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function specStrip(v: PickerVariant) {
  if (v.entityType === 'vehicle') {
    const parts: string[] = [];
    if (v.gvmKg) parts.push(`GVM ${v.gvmKg.toLocaleString()} kg`);
    if (v.maxTowingCapacityKg)
      parts.push(`Tow ${v.maxTowingCapacityKg.toLocaleString()} kg`);
    if (v.kerbWeightKg)
      parts.push(`Kerb ${v.kerbWeightKg.toLocaleString()} kg`);
    return parts.join(' · ');
  }
  const parts: string[] = [];
  const len = formatFeet(bodyFeetHalf(v.bodyLengthMm));
  if (len) parts.push(len);
  if (v.atmKg) parts.push(`ATM ${v.atmKg.toLocaleString()} kg`);
  if (v.tbmKg) parts.push(`TBM ${v.tbmKg} kg`);
  if (v.atmKg && v.tbmKg) {
    const tare = (v as PickerVariant & { tareKg?: number }).tareKg;
    if (tare) parts.push(`Tare ${tare.toLocaleString()} kg`);
  }
  return parts.join(' · ');
}

function VariantRow({
  variant,
  onSelect,
}: {
  variant: PickerVariant;
  onSelect: (v: PickerVariant) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant)}
      className="hover:bg-tb-neutral-50 active:bg-tb-neutral-200 flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors"
    >
      {/* Make logo / placeholder */}
      <div className="bg-tb-neutral-50 text-tb-primary mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded text-xs font-semibold uppercase">
        {variant.makeLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant.makeLogoUrl}
            alt={variant.makeName}
            className="h-7 w-7 object-contain"
          />
        ) : (
          variant.makeName.slice(0, 2)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center text-sm font-medium text-gray-900">
          <span className="truncate">{variantHeading(variant)}</span>
          <OriginTag code={variant.buildOrigin} />
        </p>
        <p className="text-xs text-gray-500">{displayYearSpan(variant)}</p>
        {specStrip(variant) && (
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {specStrip(variant)}
          </p>
        )}
      </div>

      <ConfidenceBadge badge={variant.confidenceBadge ?? 'manufacturer_spec'} />
    </button>
  );
}

interface SearchResultsProps {
  variants: PickerVariant[];
  isLoading: boolean;
  error: string | null;
  onSelect: (v: PickerVariant) => void;
}

export function SearchResults({
  variants,
  isLoading,
  error,
  onSelect,
}: SearchResultsProps) {
  if (error) {
    return (
      <p className="text-tb-danger px-4 py-3 text-sm font-medium">
        Search unavailable
      </p>
    );
  }
  // Demote un-named code rows to the bottom; stable sort keeps similarity order otherwise.
  const ordered = [...variants].sort(
    (a, b) => (isCrypticRow(a) ? 1 : 0) - (isCrypticRow(b) ? 1 : 0),
  );
  return (
    <div className="px-2">
      {ordered.map((v) => (
        <VariantRow key={v.id} variant={v} onSelect={onSelect} />
      ))}
      {!isLoading && variants.length === 0 && (
        <p className="px-3 py-4 text-center text-sm text-gray-400">
          No results — try a different search or browse by make
        </p>
      )}
    </div>
  );
}
