'use client';

import type { PickerConfig, PickerVariant } from './types';
import { useBrowse } from './hooks/useBrowse';
import { VariantNarrow } from './VariantNarrow';
import { variantHeading, displayYearSpan } from './display';

function labelCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Recent selections (shown above the makes grid) ───────────────────────────

function RecentStrip({
  recent,
  onSelect,
}: {
  recent: PickerVariant[];
  onSelect: (v: PickerVariant) => void;
}) {
  if (recent.length === 0) return null;
  return (
    <div className="mb-4 px-2">
      <p className="px-2 pb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
        Recent
      </p>
      {recent.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onSelect(v)}
          className="hover:bg-tb-neutral-50 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors"
        >
          <svg
            className="h-3.5 w-3.5 flex-none text-gray-400"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M8 4v4l3 3M14.5 8A6.5 6.5 0 1 1 1.5 8a6.5 6.5 0 0 1 13 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="truncate text-sm text-gray-700">
            {variantHeading(v)}
          </span>
          <span className="ml-auto flex-none text-xs text-gray-400">
            {displayYearSpan(v)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Back breadcrumb ──────────────────────────────────────────────────────────

function BackBreadcrumb({
  parts,
  onBack,
}: {
  parts: string[];
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <button
        type="button"
        onClick={onBack}
        className="text-tb-primary hover:bg-tb-primary-lighter flex items-center gap-1 rounded p-1 transition-colors"
        aria-label="Go back"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span className="text-xs text-gray-500">
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-gray-300">/</span>}
            <span
              className={
                i === parts.length - 1 ? 'font-medium text-gray-700' : ''
              }
            >
              {p}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

// ── Makes grid ─────────────────────────────────────────────────────────────

function MakesGrid({
  makes,
  popularMakeNames,
  onSelect,
}: {
  makes: ReturnType<typeof useBrowse>['makes'];
  popularMakeNames: readonly string[];
  onSelect: (make: ReturnType<typeof useBrowse>['makes'][0]) => void;
}) {
  const popular = makes.filter((m) => popularMakeNames.includes(m.name));
  const others = makes.filter((m) => !popularMakeNames.includes(m.name));

  function MakeCard({ make }: { make: (typeof makes)[0] }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(make)}
        className="border-tb-neutral-200 hover:border-tb-primary-light hover:bg-tb-primary-lighter flex flex-col items-center gap-1.5 rounded-lg border bg-white p-3 text-center transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center">
          {make.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={make.logoUrl}
              alt={make.name}
              className="h-8 w-8 object-contain"
            />
          ) : (
            <span className="text-tb-primary text-base font-bold">
              {make.name.slice(0, 2)}
            </span>
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
          <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
            Popular
          </p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {popular.map((m) => (
              <MakeCard key={m.id} make={m} />
            ))}
          </div>
        </>
      )}
      {others.length > 0 && (
        <>
          {popular.length > 0 && (
            <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
              All makes
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {others.map((m) => (
              <MakeCard key={m.id} make={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Models list ────────────────────────────────────────────────────────────

function ModelsList({
  models,
  onSelect,
}: {
  models: ReturnType<typeof useBrowse>['models'];
  onSelect: (model: ReturnType<typeof useBrowse>['models'][0]) => void;
}) {
  return (
    <div className="divide-tb-neutral-200 divide-y px-2">
      {models.map((model) => (
        <button
          key={model.id}
          type="button"
          onClick={() => onSelect(model)}
          className="hover:bg-tb-neutral-50 flex w-full items-center justify-between rounded px-3 py-3 text-left transition-colors"
        >
          <div>
            <span className="text-sm font-medium text-gray-900">
              {model.name}
            </span>
            <span className="ml-2 text-xs text-gray-400">
              {labelCase(model.bodyType)}
            </span>
          </div>
          <svg
            className="h-4 w-4 flex-none text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

interface BrowseTabProps {
  config: PickerConfig;
  recent?: PickerVariant[];
  onSelect: (v: PickerVariant) => void;
}

export function BrowseTab({ config, recent = [], onSelect }: BrowseTabProps) {
  const {
    step,
    makes,
    models,
    allVariants,
    selectedMake,
    selectedModel,
    isLoading,
    error,
    selectMake,
    selectModel,
    goBack,
  } = useBrowse(config);

  const breadcrumbs =
    step === 'models' && selectedMake
      ? [selectedMake.name]
      : step === 'variants' && selectedMake && selectedModel
        ? [selectedMake.name, selectedModel.name]
        : [];

  return (
    <div className="flex flex-col">
      {breadcrumbs.length > 0 && (
        <BackBreadcrumb parts={breadcrumbs} onBack={goBack} />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg
            className="text-tb-primary h-5 w-5 animate-spin"
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
        </div>
      )}

      {error && !isLoading && (
        <p className="text-tb-danger px-4 py-4 text-sm">{error}</p>
      )}

      {!isLoading && !error && (
        <>
          {step === 'makes' && (
            <>
              <RecentStrip recent={recent} onSelect={onSelect} />
              <MakesGrid
                makes={makes}
                popularMakeNames={config.popularMakeNames}
                onSelect={selectMake}
              />
            </>
          )}
          {step === 'models' && (
            <ModelsList models={models} onSelect={selectModel} />
          )}
          {step === 'variants' && (
            <VariantNarrow
              key={selectedModel?.id}
              variants={allVariants}
              entity={config.entityType}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </div>
  );
}
