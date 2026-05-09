'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/** Metric labels matching Phase 4 physics engine outputs */
const METRICS = [
  { key: 'gvm', label: 'GVM', sublabel: 'Gross Vehicle Mass' },
  { key: 'rearAxle', label: 'Rear Axle', sublabel: 'Rear axle load' },
  { key: 'frontAxle', label: 'Front Axle', sublabel: 'Front axle load' },
  { key: 'towBall', label: 'Tow Ball', sublabel: 'Tow ball mass' },
  { key: 'gcm', label: 'GCM', sublabel: 'Gross Combined Mass' },
] as const;

// ── Sheet content (skeleton state) ────────────────────────────────────────────

function SkeletonBar({ widthClass = 'w-1/3' }: { widthClass?: string }) {
  return <div className={`h-2 rounded-full bg-gray-200 ${widthClass}`} />;
}

function VerdictBannerSkeleton() {
  return (
    <div className="mb-4 rounded-md bg-gray-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-gray-300" />
        <SkeletonBar widthClass="w-40" />
      </div>
      <SkeletonBar widthClass="w-56 mt-2" />
    </div>
  );
}

function MetricRow({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 shrink-0">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400">{sublabel}</p>
      </div>
      <div className="relative flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-0 rounded-full bg-gray-200" />
      </div>
      <div className="w-14 shrink-0">
        <SkeletonBar widthClass="w-full" />
      </div>
    </div>
  );
}

function MetricGridSkeleton() {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Load metrics
      </p>
      <div className="divide-y divide-gray-100">
        {METRICS.map((m) => (
          <MetricRow key={m.key} label={m.label} sublabel={m.sublabel} />
        ))}
      </div>
    </div>
  );
}

function RecommendationsStub() {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
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
    <div className="mb-4 rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        aria-expanded={open}
        style={{ minHeight: 44 }}
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
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-400">Advanced options will appear here.</p>
        </div>
      )}
    </div>
  );
}

function ActionBar() {
  return (
    <div className="flex gap-2 border-t border-gray-200 bg-white pt-4 pb-2">
      {[
        {
          label: 'Save',
          icon: (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          ),
        },
        {
          label: 'Share',
          icon: (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          ),
        },
        {
          label: 'PDF',
          icon: (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          ),
        },
      ].map(({ label, icon }) => (
        <button
          key={label}
          type="button"
          disabled
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 text-sm text-gray-400 cursor-not-allowed"
          style={{ minHeight: 44 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            {icon}
          </svg>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

function ResultsSheet({ open, onClose }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [translateY, setTranslateY] = useState(0);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Drag-to-dismiss via touch
  function onTouchStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      dragCurrentY.current = delta;
      setTranslateY(delta);
    }
  }
  function onTouchEnd() {
    if (dragCurrentY.current > 100) {
      setTranslateY(0);
      dragStartY.current = null;
      onClose();
    } else {
      setTranslateY(0);
      dragStartY.current = null;
    }
  }

  // Reset translate when sheet opens
  useEffect(() => {
    if (open) setTranslateY(0);
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Results"
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-xl transition-transform duration-300 ease-out md:hidden`}
        style={{
          height: '88vh',
          maxHeight: '88vh',
          transform: open
            ? `translateY(${translateY}px)`
            : 'translateY(100%)',
        }}
      >
        {/* Drag handle — touch target wraps the visual pip */}
        <div
          className="flex shrink-0 cursor-grab items-center justify-center py-3 active:cursor-grabbing"
          style={{ minHeight: 44 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 pb-3">
          <h2 className="text-base font-semibold text-gray-900">Results</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600"
            style={{ minHeight: 44, minWidth: 44 }}
            aria-label="Close results"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <VerdictBannerSkeleton />
          <MetricGridSkeleton />
          <RecommendationsStub />
          <AdvancedPanel />
          <ActionBar />
        </div>
      </div>
    </>
  );
}

// ── Sticky bottom bar ──────────────────────────────────────────────────────────

interface MobileResultsBarProps {
  vehicleSelected: boolean;
}

export function MobileResultsBar({ vehicleSelected }: MobileResultsBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Sticky bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-all duration-300 ease-out ${
          vehicleSelected
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-between bg-white border-t border-gray-200 px-4 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
          style={{ height: 60, minHeight: 44 }}
          aria-label="View results"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          {/* Left: status dot + label */}
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" aria-hidden="true" />
            <span className="text-sm text-gray-500">Tap to view results</span>
          </div>

          {/* Right: chevron up */}
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      <ResultsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
