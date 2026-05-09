'use client';

import type { PickerVariant, PickerConfig } from './types';
import { useSearch } from './hooks/useSearch';

const BADGE_CONFIG: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
  manufacturer_spec: { label: 'OEM Spec', cls: 'bg-blue-100 text-blue-700' },
  community: { label: 'Community', cls: 'bg-yellow-100 text-yellow-700' },
  estimated: { label: 'Estimated', cls: 'bg-gray-100 text-gray-500' },
};

function ConfidenceBadge({ badge }: { badge: string }) {
  const cfg = BADGE_CONFIG[badge] ?? BADGE_CONFIG.estimated;
  return (
    <span className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function yearSpan(v: PickerVariant) {
  return v.isCurrentProduction ? `${v.yearFrom}–present` : `${v.yearFrom}–${v.yearTo}`;
}

function specStrip(v: PickerVariant) {
  if (v.entityType === 'vehicle') {
    const parts: string[] = [];
    if (v.gvmKg) parts.push(`GVM ${v.gvmKg.toLocaleString()} kg`);
    if (v.maxTowingCapacityKg) parts.push(`Tow ${v.maxTowingCapacityKg.toLocaleString()} kg`);
    if (v.kerbWeightKg) parts.push(`Kerb ${v.kerbWeightKg.toLocaleString()} kg`);
    return parts.join(' · ');
  }
  const parts: string[] = [];
  if (v.atmKg) parts.push(`ATM ${v.atmKg.toLocaleString()} kg`);
  if (v.tbmKg) parts.push(`TBM ${v.tbmKg} kg`);
  if (v.atmKg && v.tbmKg) {
    const tare = (v as PickerVariant & { tareKg?: number }).tareKg;
    if (tare) parts.push(`Tare ${tare.toLocaleString()} kg`);
  }
  return parts.join(' · ');
}

interface VariantRowProps {
  variant: PickerVariant;
  onSelect: (v: PickerVariant) => void;
}

function VariantRow({ variant, onSelect }: VariantRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant)}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-tb-neutral-50 active:bg-tb-neutral-200"
    >
      {/* Make logo / placeholder */}
      <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded bg-tb-neutral-50 text-xs font-semibold uppercase text-tb-primary">
        {variant.makeLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={variant.makeLogoUrl} alt={variant.makeName} className="h-7 w-7 object-contain" />
        ) : (
          variant.makeName.slice(0, 2)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {variant.makeName} {variant.modelName} {variant.name}
        </p>
        <p className="text-xs text-gray-500">{yearSpan(variant)}</p>
        {specStrip(variant) && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{specStrip(variant)}</p>
        )}
      </div>

      <ConfidenceBadge badge={variant.confidenceBadge ?? 'manufacturer_spec'} />
    </button>
  );
}

interface RecentRowProps {
  variant: PickerVariant;
  onSelect: (v: PickerVariant) => void;
}

function RecentRow({ variant, onSelect }: RecentRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant)}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-tb-neutral-50"
    >
      <svg className="h-3.5 w-3.5 flex-none text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M8 4v4l3 3M14.5 8A6.5 6.5 0 1 1 1.5 8a6.5 6.5 0 0 1 13 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate text-sm text-gray-700">
        {variant.makeName} {variant.modelName} {variant.name}
      </span>
      <span className="flex-none text-xs text-gray-400">{yearSpan(variant)}</span>
    </button>
  );
}

interface SearchTabProps {
  config: PickerConfig;
  recent: PickerVariant[];
  onSelect: (v: PickerVariant) => void;
}

export function SearchTab({ config, recent, onSelect }: SearchTabProps) {
  const { query, setQuery, variants, isLoading, error } = useSearch(config);

  const showEmpty = !query.trim();
  const showResults = !showEmpty && (variants.length > 0 || isLoading || !!error);

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="relative px-4 pb-3">
        <div className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2">
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${config.label} make, model, or year…`}
          autoFocus
          className="w-full rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-tb-primary-light focus:ring-1 focus:ring-tb-primary-light"
        />
        {isLoading && (
          <div className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 animate-spin text-tb-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="px-4 py-3 text-sm font-medium text-tb-danger">Search unavailable</p>
      )}

      {/* Results */}
      {showResults && !error && (
        <div className="px-2">
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onSelect={onSelect} />
          ))}
          {!isLoading && variants.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              No results — try a different search or browse by make
            </p>
          )}
        </div>
      )}

      {/* Empty state — recent selections */}
      {showEmpty && (
        <div className="px-2">
          {recent.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                Recent
              </p>
              {recent.map((v) => (
                <RecentRow key={v.id} variant={v} onSelect={onSelect} />
              ))}
            </>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Search for your {config.label} above
            </p>
          )}
        </div>
      )}
    </div>
  );
}
