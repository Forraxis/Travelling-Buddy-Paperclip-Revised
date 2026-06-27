'use client';

import type { PickerVariant, PickerConfig } from './types';
import { useSearch } from './hooks/useSearch';
import { SearchResults } from './SearchResults';
import { BrowseTab } from './BrowseTab';

// ─────────────────────────────────────────────────────────────────────────────
// The picker body — a single surface (carsales/caravansales style): a persistent
// search bar pinned to the top, with Browse beneath it. Typing flips the area to
// live search results; clearing returns to Browse. No two-tab toggle.
// ─────────────────────────────────────────────────────────────────────────────

interface PickerBodyProps {
  config: PickerConfig;
  recent: PickerVariant[];
  onSelect: (v: PickerVariant) => void;
}

export function PickerBody({ config, recent, onSelect }: PickerBodyProps) {
  const { query, setQuery, variants, isLoading, error } = useSearch(config);
  const searching = query.trim().length > 0;

  // Free-text facet search understands config tokens — nudge with a worked
  // example (CATALOGUE_GRANULARITY_PLAN.md milestone 4).
  const example =
    config.entityType === 'vehicle'
      ? 'navara 4x4 dual cab'
      : 'jayco journey 16\'6"';

  return (
    <div className="flex h-full flex-col">
      {/* Persistent search bar */}
      <div className="border-tb-neutral-200 relative flex-none border-b px-4 pt-1 pb-3">
        <div className="pointer-events-none absolute top-1/2 left-7 -translate-y-1/2">
          <svg
            className="h-4 w-4 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search make, model, or "${example}"…`}
          className="border-tb-neutral-200 bg-tb-neutral-50 focus:border-tb-primary-light focus:ring-tb-primary-light w-full rounded-lg border py-2.5 pr-10 pl-9 text-sm outline-none placeholder:text-gray-400 focus:ring-1 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-6 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            {isLoading ? (
              <svg
                className="text-tb-primary h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Body — search results when typing, Browse otherwise */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-3">
        {searching ? (
          <SearchResults
            variants={variants}
            isLoading={isLoading}
            error={error}
            onSelect={onSelect}
          />
        ) : (
          <BrowseTab config={config} recent={recent} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
