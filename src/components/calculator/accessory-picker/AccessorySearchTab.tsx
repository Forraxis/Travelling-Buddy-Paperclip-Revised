'use client';

import type { AccessoryItem } from './types';
import { useAccessorySearch } from './hooks/useAccessorySearch';

function mountingLabel(location: string) {
  return location.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AccessoryRowProps {
  item: AccessoryItem;
  onAdd: (item: AccessoryItem) => void;
}

function AccessoryRow({ item, onAdd }: AccessoryRowProps) {
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-tb-neutral-50 active:bg-tb-neutral-200"
    >
      <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded bg-tb-neutral-50 text-xs font-bold uppercase text-tb-primary">
        {item.brandLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.brandLogoUrl} alt={item.brandName} className="h-7 w-7 object-contain" />
        ) : (
          item.brandName.slice(0, 2)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {item.brandName} {item.name}
        </p>
        <p className="text-xs text-gray-400">
          {item.categoryName} · {mountingLabel(item.mountingLocation)}
        </p>
      </div>
      <span className="flex-none text-xs font-medium tabular-nums text-gray-500">
        {item.installedWeightKg} kg
      </span>
    </button>
  );
}

interface RecentRowProps {
  item: AccessoryItem;
  onAdd: (item: AccessoryItem) => void;
}

function RecentRow({ item, onAdd }: RecentRowProps) {
  const isCommunity = item.fitmentId.startsWith('community:');
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-tb-neutral-50"
    >
      <svg className="h-3.5 w-3.5 flex-none text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M8 4v4l3 3M14.5 8A6.5 6.5 0 1 1 1.5 8a6.5 6.5 0 0 1 13 0Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
        {item.brandName} {item.name}
      </span>
      {isCommunity && (
        <span className="flex-none rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
          Awaiting review
        </span>
      )}
      <span className="flex-none text-xs text-gray-400">{item.installedWeightKg} kg</span>
    </button>
  );
}

interface AccessorySearchTabProps {
  recent: AccessoryItem[];
  onAdd: (item: AccessoryItem) => void;
  context?: 'vehicle' | 'caravan';
}

export function AccessorySearchTab({ recent, onAdd, context = 'vehicle' }: AccessorySearchTabProps) {
  const { query, setQuery, items, isLoading, error } = useAccessorySearch(15, context);

  const showEmpty = !query.trim();
  const showResults = !showEmpty && (items.length > 0 || isLoading || !!error);

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
          placeholder="Search accessories by name or brand…"
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

      {error && (
        <p className="px-4 py-3 text-sm font-medium text-tb-danger">Search unavailable</p>
      )}

      {showResults && !error && (
        <div className="px-2">
          {items.map((item) => (
            <AccessoryRow key={item.fitmentId} item={item} onAdd={onAdd} />
          ))}
          {!isLoading && items.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              No results — try a different search or browse by category
            </p>
          )}
        </div>
      )}

      {showEmpty && (
        <div className="px-2">
          {recent.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                Recently added
              </p>
              {recent.map((item) => (
                <RecentRow key={item.fitmentId} item={item} onAdd={onAdd} />
              ))}
            </>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              Search for an accessory above
            </p>
          )}
        </div>
      )}
    </div>
  );
}
