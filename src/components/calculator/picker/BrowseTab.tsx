'use client';

import type { PickerVariant, PickerConfig } from './types';
import { useBrowse } from './hooks/useBrowse';

function yearSpan(v: PickerVariant) {
  return v.isCurrentProduction ? `${v.yearFrom}–present` : `${v.yearFrom}–${v.yearTo}`;
}

// ── Filter chip helpers ────────────────────────────────────────────────────

function uniqueNonEmpty<T>(arr: (T | undefined | null)[]): T[] {
  return [...new Set(arr.filter((x): x is T => x != null && x !== ''))];
}

function labelCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface BackBreadcrumbProps {
  parts: string[];
  onBack: () => void;
}

function BackBreadcrumb({ parts, onBack }: BackBreadcrumbProps) {
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

// ── Makes grid ─────────────────────────────────────────────────────────────

interface MakesGridProps {
  makes: ReturnType<typeof useBrowse>['makes'];
  popularMakeNames: readonly string[];
  onSelect: (make: ReturnType<typeof useBrowse>['makes'][0]) => void;
}

function MakesGrid({ makes, popularMakeNames, onSelect }: MakesGridProps) {
  const popular = makes.filter((m) => popularMakeNames.includes(m.name));
  const others = makes.filter((m) => !popularMakeNames.includes(m.name));

  function MakeCard({ make }: { make: typeof makes[0] }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(make)}
        className="flex flex-col items-center gap-1.5 rounded-lg border border-tb-neutral-200 bg-white p-3 text-center transition-colors hover:border-tb-primary-light hover:bg-tb-primary-lighter"
      >
        <div className="flex h-10 w-10 items-center justify-center">
          {make.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={make.logoUrl} alt={make.name} className="h-8 w-8 object-contain" />
          ) : (
            <span className="text-base font-bold text-tb-primary">{make.name.slice(0, 2)}</span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-700">{make.name}</span>
      </button>
    );
  }

  return (
    <div className="px-4">
      {popular.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Popular</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {popular.map((m) => <MakeCard key={m.id} make={m} />)}
          </div>
        </>
      )}
      {others.length > 0 && (
        <>
          {popular.length > 0 && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">All makes</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {others.map((m) => <MakeCard key={m.id} make={m} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Models list ────────────────────────────────────────────────────────────

interface ModelsListProps {
  models: ReturnType<typeof useBrowse>['models'];
  onSelect: (model: ReturnType<typeof useBrowse>['models'][0]) => void;
}

function ModelsList({ models, onSelect }: ModelsListProps) {
  return (
    <div className="divide-y divide-tb-neutral-200 px-2">
      {models.map((model) => (
        <button
          key={model.id}
          type="button"
          onClick={() => onSelect(model)}
          className="flex w-full items-center justify-between rounded px-3 py-3 text-left transition-colors hover:bg-tb-neutral-50"
        >
          <div>
            <span className="text-sm font-medium text-gray-900">{model.name}</span>
            <span className="ml-2 text-xs text-gray-400">{labelCase(model.bodyType)}</span>
          </div>
          <svg className="h-4 w-4 flex-none text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Variants list ──────────────────────────────────────────────────────────

interface VariantsListProps {
  config: PickerConfig;
  variants: PickerVariant[];
  allVariants: PickerVariant[];
  filters: ReturnType<typeof useBrowse>['filters'];
  onFilter: (patch: Partial<ReturnType<typeof useBrowse>['filters']>) => void;
  onSelect: (v: PickerVariant) => void;
}

function VariantsList({ config, variants, allVariants, filters, onFilter, onSelect }: VariantsListProps) {
  // Derive non-empty filter options from allVariants
  const bodyTypes = uniqueNonEmpty(allVariants.map((v) => v.bodyType));
  const fuelTypes = uniqueNonEmpty(allVariants.map((v) => v.fuelType));
  const axleConfigs = uniqueNonEmpty(allVariants.map((v) => v.axleConfiguration));

  function SpecStrip({ v }: { v: PickerVariant }) {
    if (v.entityType === 'vehicle') {
      return (
        <p className="mt-0.5 text-xs text-gray-400">
          {[
            v.gvmKg && `GVM ${v.gvmKg.toLocaleString()} kg`,
            v.maxTowingCapacityKg && `Tow ${v.maxTowingCapacityKg.toLocaleString()} kg`,
            v.kerbWeightKg && `Kerb ${v.kerbWeightKg.toLocaleString()} kg`,
          ].filter(Boolean).join(' · ')}
        </p>
      );
    }
    return (
      <p className="mt-0.5 text-xs text-gray-400">
        {[
          v.atmKg && `ATM ${v.atmKg.toLocaleString()} kg`,
          v.tbmKg && `TBM ${v.tbmKg} kg`,
          v.axleConfiguration && labelCase(v.axleConfiguration),
        ].filter(Boolean).join(' · ')}
      </p>
    );
  }

  return (
    <div>
      {/* Filter chips */}
      {(bodyTypes.length > 1 || fuelTypes.length > 1 || axleConfigs.length > 1) && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 scrollbar-none">
          {bodyTypes.length > 1 && bodyTypes.map((bt) => (
            <button
              key={bt}
              type="button"
              onClick={() => onFilter({ bodyType: filters.bodyType === bt ? undefined : bt })}
              className={`flex-none rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filters.bodyType === bt
                  ? 'border-tb-primary bg-tb-primary text-white'
                  : 'border-tb-neutral-200 bg-white text-gray-600 hover:border-tb-primary-light'
              }`}
            >
              {labelCase(bt)}
            </button>
          ))}
          {config.entityType === 'vehicle' && fuelTypes.length > 1 && fuelTypes.map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => onFilter({ fuelType: filters.fuelType === ft ? undefined : ft })}
              className={`flex-none rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filters.fuelType === ft
                  ? 'border-tb-primary bg-tb-primary text-white'
                  : 'border-tb-neutral-200 bg-white text-gray-600 hover:border-tb-primary-light'
              }`}
            >
              {labelCase(ft)}
            </button>
          ))}
          {config.entityType === 'caravan' && axleConfigs.length > 1 && axleConfigs.map((ac) => (
            <button
              key={ac}
              type="button"
              onClick={() => onFilter({ axleConfiguration: filters.axleConfiguration === ac ? undefined : ac })}
              className={`flex-none rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filters.axleConfiguration === ac
                  ? 'border-tb-primary bg-tb-primary text-white'
                  : 'border-tb-neutral-200 bg-white text-gray-600 hover:border-tb-primary-light'
              }`}
            >
              {labelCase(ac)}
            </button>
          ))}
        </div>
      )}

      {/* Variant rows */}
      <div className="divide-y divide-tb-neutral-200 px-2">
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className="flex w-full flex-col rounded px-3 py-3 text-left transition-colors hover:bg-tb-neutral-50"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">{v.name}</span>
              <span className="flex-none text-xs text-gray-500">{yearSpan(v)}</span>
            </div>
            <SpecStrip v={v} />
          </button>
        ))}
        {variants.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">
            No variants match the selected filters.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

interface BrowseTabProps {
  config: PickerConfig;
  onSelect: (v: PickerVariant) => void;
}

export function BrowseTab({ config, onSelect }: BrowseTabProps) {
  const {
    step,
    makes,
    models,
    variants,
    allVariants,
    selectedMake,
    selectedModel,
    filters,
    isLoading,
    error,
    selectMake,
    selectModel,
    goBack,
    updateFilter,
  } = useBrowse(config);

  const breadcrumbs =
    step === 'models' && selectedMake
      ? [selectedMake.name]
      : step === 'variants' && selectedMake && selectedModel
        ? [selectedMake.name, selectedModel.name]
        : [];

  return (
    <div className="flex flex-col">
      {/* Breadcrumb nav */}
      {breadcrumbs.length > 0 && (
        <BackBreadcrumb parts={breadcrumbs} onBack={goBack} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-tb-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <p className="px-4 py-4 text-sm text-tb-danger">{error}</p>
      )}

      {/* Step content */}
      {!isLoading && !error && (
        <>
          {step === 'makes' && (
            <MakesGrid
              makes={makes}
              popularMakeNames={config.popularMakeNames}
              onSelect={selectMake}
            />
          )}
          {step === 'models' && (
            <ModelsList models={models} onSelect={selectModel} />
          )}
          {step === 'variants' && (
            <VariantsList
              config={config}
              variants={variants}
              allVariants={allVariants}
              filters={filters}
              onFilter={updateFilter}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </div>
  );
}
