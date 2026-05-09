'use client';

import { useState } from 'react';

/** Metric labels matching Phase 4 physics engine outputs */
const METRICS = [
  { key: 'gvm', label: 'GVM', sublabel: 'Gross Vehicle Mass' },
  { key: 'rearAxle', label: 'Rear Axle', sublabel: 'Rear axle load' },
  { key: 'frontAxle', label: 'Front Axle', sublabel: 'Front axle load' },
  { key: 'towBall', label: 'Tow Ball', sublabel: 'Tow ball mass' },
  { key: 'gcm', label: 'GCM', sublabel: 'Gross Combined Mass' },
] as const;

function VehicleIcon() {
  return (
    <svg
      width="96"
      height="64"
      viewBox="0 0 96 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Tow vehicle body */}
      <rect x="2" y="20" width="42" height="24" rx="4" fill="#e5e7eb" />
      <rect x="8" y="12" width="28" height="12" rx="3" fill="#d1d5db" />
      {/* Windows */}
      <rect x="11" y="14" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <rect x="23" y="14" width="10" height="8" rx="1.5" fill="#f9fafb" />
      {/* Tow vehicle wheels */}
      <circle cx="14" cy="45" r="6" fill="#9ca3af" />
      <circle cx="14" cy="45" r="3" fill="#e5e7eb" />
      <circle cx="34" cy="45" r="6" fill="#9ca3af" />
      <circle cx="34" cy="45" r="3" fill="#e5e7eb" />
      {/* Tow bar */}
      <rect x="44" y="30" width="12" height="3" rx="1.5" fill="#9ca3af" />
      {/* Caravan body */}
      <rect x="54" y="18" width="38" height="26" rx="4" fill="#e5e7eb" />
      {/* Caravan window */}
      <rect x="60" y="23" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <rect x="74" y="23" width="10" height="8" rx="1.5" fill="#f9fafb" />
      {/* Caravan door */}
      <rect x="83" y="28" width="6" height="14" rx="1" fill="#d1d5db" />
      {/* Caravan wheel */}
      <circle cx="68" cy="45" r="6" fill="#9ca3af" />
      <circle cx="68" cy="45" r="3" fill="#e5e7eb" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 opacity-70">
        <VehicleIcon />
      </div>
      <p className="text-base font-medium text-tb-primary">Select your vehicle to get started</p>
      <p className="mt-1 text-sm text-gray-400">
        Your compliance results will appear here once a vehicle is configured.
      </p>
    </div>
  );
}

function SkeletonBar({ widthClass = 'w-1/3' }: { widthClass?: string }) {
  return (
    <div className={`h-2 rounded-full bg-tb-neutral-200 ${widthClass}`} />
  );
}

function MetricRow({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 shrink-0">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400">{sublabel}</p>
      </div>
      {/* Progress bar track */}
      <div className="relative flex-1 h-3 rounded-full bg-tb-neutral-200 overflow-hidden">
        {/* Empty fill — greyed placeholder */}
        <div className="absolute inset-y-0 left-0 w-0 rounded-full bg-tb-neutral-200" />
      </div>
      {/* Value placeholder */}
      <div className="w-14 shrink-0">
        <SkeletonBar widthClass="w-full" />
      </div>
    </div>
  );
}

function VerdictBannerSkeleton() {
  return (
    <div className="mb-4 rounded-md bg-tb-neutral-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-gray-300" />
        <SkeletonBar widthClass="w-40" />
      </div>
      <SkeletonBar widthClass="w-56 mt-2" />
    </div>
  );
}

function MetricGridSkeleton() {
  return (
    <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Load metrics
      </p>
      <div className="divide-y divide-tb-neutral-200">
        {METRICS.map((m) => (
          <MetricRow key={m.key} label={m.label} sublabel={m.sublabel} />
        ))}
      </div>
    </div>
  );
}

function RecommendationsStub() {
  return (
    <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Recommendations
      </p>
      <p className="text-sm text-gray-400">No recommendations yet.</p>
    </div>
  );
}

function AdvancedPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-lg border border-tb-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        aria-expanded={open}
      >
        Advanced
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-tb-neutral-200 px-4 py-3">
          <p className="text-sm text-gray-400">Advanced options will appear here.</p>
        </div>
      )}
    </div>
  );
}

function ActionBar() {
  return (
    <div className="mt-auto flex gap-2 border-t border-tb-neutral-200 bg-white pt-4">
      <button
        type="button"
        disabled
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-tb-neutral-200 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Save
      </button>
      <button
        type="button"
        disabled
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-tb-neutral-200 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>
      <button
        type="button"
        disabled
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-tb-neutral-200 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        PDF
      </button>
    </div>
  );
}

function SkeletonState() {
  return (
    <>
      <VerdictBannerSkeleton />
      <MetricGridSkeleton />
      <RecommendationsStub />
      <AdvancedPanel />
      <ActionBar />
    </>
  );
}

interface RightColumnProps {
  vehicleSelected?: boolean;
}

export default function RightColumn({ vehicleSelected = false }: RightColumnProps) {
  return (
    <div className="hidden md:flex md:w-[45%] lg:w-[40%] md:flex-none md:flex-col md:border-l md:border-tb-neutral-200 md:bg-white">
      <div className="sticky top-0 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto px-4 py-6">
        {vehicleSelected ? <SkeletonState /> : <EmptyState />}
      </div>
    </div>
  );
}
