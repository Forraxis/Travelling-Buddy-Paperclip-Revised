'use client';

import type { AccessoryCategory, AccessoryBrand, AccessoryItem } from './types';
import { useAccessoryBrowse } from './hooks/useAccessoryBrowse';

function mountingLabel(location: string) {
  return location.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Back breadcrumb ────────────────────────────────────────────────────────────

function BackBreadcrumb({ parts, onBack }: { parts: string[]; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded p-1 text-tb-primary transition-colors hover:bg-tb-primary-lighter"
        aria-label="Go back"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>
      <span className="text-xs text-gray-500">
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-gray-300">/</span>}
            <span className={i === parts.length - 1 ? 'font-medium text-gray-700' : ''}>{p}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

// ── Category grid ──────────────────────────────────────────────────────────────

const CATEGORY_ICON_MAP: Record<string, string> = {
  bullbars: '🛡',
  'roof-racks': '📦',
  drawers: '🗄',
  fridge: '❄',
  recovery: '🔧',
  lighting: '💡',
  suspension: '⚙',
  tyres: '⭕',
  camping: '⛺',
  electrical: '⚡',
  water: '💧',
  storage: '📦',
};

function categoryIcon(cat: AccessoryCategory) {
  if (cat.iconName) return cat.iconName;
  return CATEGORY_ICON_MAP[cat.slug] ?? '📦';
}

function CategoryGrid({ categories, onSelect }: { categories: AccessoryCategory[]; onSelect: (c: AccessoryCategory) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat)}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-tb-neutral-200 bg-white px-2 py-3 text-center transition-colors hover:border-tb-primary-light hover:bg-tb-primary-lighter"
        >
          <span className="text-xl" role="img" aria-hidden="true">{categoryIcon(cat)}</span>
          <span className="text-xs font-medium leading-tight text-gray-700">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}

// ── Brand list ─────────────────────────────────────────────────────────────────

function BrandList({ brands, onSelect }: { brands: AccessoryBrand[]; onSelect: (b: AccessoryBrand) => void }) {
  return (
    <div className="divide-y divide-tb-neutral-200 px-2">
      {brands.map((brand) => (
        <button
          key={brand.id}
          type="button"
          onClick={() => onSelect(brand)}
          className="flex w-full items-center gap-3 rounded px-3 py-3 text-left transition-colors hover:bg-tb-neutral-50"
        >
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded bg-tb-neutral-50 text-xs font-bold text-tb-primary">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.name} className="h-6 w-6 object-contain" />
            ) : (
              brand.name.slice(0, 2)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-900">{brand.name}</span>
            {brand.isPartner && (
              <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">Partner</span>
            )}
          </div>
          <span className="flex-none text-xs text-gray-400">{brand.accessoryCount}</span>
          <svg className="h-4 w-4 flex-none text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      ))}
      {brands.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-gray-400">No brands in this category yet.</p>
      )}
    </div>
  );
}

// ── Items list ─────────────────────────────────────────────────────────────────

function ItemsList({
  items,
  allLocations,
  activeLocation,
  onLocationFilter,
  onAdd,
}: {
  items: AccessoryItem[];
  allLocations: string[];
  activeLocation: string | undefined;
  onLocationFilter: (loc: string | undefined) => void;
  onAdd: (item: AccessoryItem) => void;
}) {
  return (
    <div>
      {allLocations.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 scrollbar-none">
          {allLocations.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => onLocationFilter(activeLocation === loc ? undefined : loc)}
              className={`flex-none rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeLocation === loc
                  ? 'border-tb-primary bg-tb-primary text-white'
                  : 'border-tb-neutral-200 bg-white text-gray-600 hover:border-tb-primary-light'
              }`}
            >
              {mountingLabel(loc)}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-tb-neutral-200 px-2">
        {items.map((item) => (
          <button
            key={item.fitmentId}
            type="button"
            onClick={() => onAdd(item)}
            className="flex w-full items-center gap-2 rounded px-3 py-3 text-left transition-colors hover:bg-tb-neutral-50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              <p className="mt-0.5 text-xs text-gray-400">{mountingLabel(item.mountingLocation)}</p>
            </div>
            <span className="flex-none rounded-full border border-tb-neutral-200 bg-tb-neutral-50 px-2 py-0.5 text-xs font-medium text-gray-600">
              {item.installedWeightKg} kg
            </span>
          </button>
        ))}
        {items.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">No accessories match the selected filter.</p>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface AccessoryBrowseTabProps {
  onAdd: (item: AccessoryItem) => void;
}

export function AccessoryBrowseTab({ onAdd }: AccessoryBrowseTabProps) {
  const {
    step,
    selectedCategory,
    selectedBrand,
    categories,
    brands,
    items,
    allLocations,
    activeLocation,
    setActiveLocation,
    isLoading,
    error,
    selectCategory,
    selectBrand,
    goBack,
  } = useAccessoryBrowse();

  const breadcrumbs =
    step === 'brands' && selectedCategory
      ? [selectedCategory.name]
      : step === 'items' && selectedCategory && selectedBrand
        ? [selectedCategory.name, selectedBrand.name]
        : [];

  return (
    <div className="flex flex-col">
      {breadcrumbs.length > 0 && (
        <BackBreadcrumb parts={breadcrumbs} onBack={goBack} />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-tb-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {error && !isLoading && (
        <p className="px-4 py-4 text-sm text-tb-danger">{error}</p>
      )}

      {!isLoading && !error && (
        <>
          {step === 'categories' && (
            <CategoryGrid categories={categories} onSelect={selectCategory} />
          )}
          {step === 'brands' && (
            <BrandList brands={brands} onSelect={selectBrand} />
          )}
          {step === 'items' && (
            <ItemsList
              items={items}
              allLocations={allLocations}
              activeLocation={activeLocation}
              onLocationFilter={setActiveLocation}
              onAdd={onAdd}
            />
          )}
        </>
      )}
    </div>
  );
}
