'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { PhysicsResult, MetricStatus } from '@/lib/physics/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColor(status: MetricStatus): string {
  if (status === 'fail') return 'bg-red-500';
  if (status === 'warn') return 'bg-amber-400';
  return 'bg-green-500';
}

function clampPct(val: number, limit: number): number {
  return Math.min(100, (val / limit) * 100);
}

function fmt(kg: number): string {
  return `${Math.round(kg).toLocaleString()} kg`;
}

// ── Sheet content ──────────────────────────────────────────────────────────────

function VerdictBanner({ result }: { result: PhysicsResult }) {
  const { overallStatus } = result;
  const label =
    overallStatus === 'pass' ? 'All checks pass' :
    overallStatus === 'warn' ? 'Approaching limits' :
    'Over limit';
  const sub =
    overallStatus === 'pass' ? 'Your rig is within all compliance limits.' :
    overallStatus === 'warn' ? 'One or more metrics are approaching their limit.' :
    'One or more limits are exceeded. Adjust your load.';
  const dot =
    overallStatus === 'pass' ? 'bg-green-500' :
    overallStatus === 'warn' ? 'bg-amber-400' :
    'bg-red-500';
  const bg =
    overallStatus === 'pass' ? 'bg-green-50 border-green-200' :
    overallStatus === 'warn' ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200';

  return (
    <div className={`mb-4 rounded-md border px-4 py-3 ${bg}`}>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-800">{label}</p>
      </div>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function GvmBar({ result }: { result: PhysicsResult }) {
  const { totalWeightKg, gvmLimitKg, gvmStatus } = result.vehicle;
  const pct = clampPct(totalWeightKg, gvmLimitKg);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">GVM</p>
          <p className="text-[10px] text-gray-400">Gross Vehicle Mass</p>
        </div>
        <span className="text-xs tabular-nums text-gray-500">{Math.round(pct)}%</span>
      </div>
      <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(gvmStatus)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{fmt(totalWeightKg)}</span>
        <span>limit {fmt(gvmLimitKg)}</span>
      </div>
    </div>
  );
}

function PayloadCard({ result }: { result: PhysicsResult }) {
  if (!result.caravan) return null;
  const { payloadRemainingKg, payloadStatus, atmLimitKg, effectiveTareKg, accessoryMassKg, freshWaterMassKg, greyWaterMassKg } = result.caravan;
  const usedKg = atmLimitKg - payloadRemainingKg;
  const pct = clampPct(usedKg, atmLimitKg);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">Payload Remaining</p>
          <p className="text-[10px] text-gray-400">Caravan ATM headroom</p>
        </div>
        <p className={`text-sm font-bold tabular-nums ${payloadRemainingKg < 0 ? 'text-red-600' : 'text-green-600'}`}>
          {payloadRemainingKg >= 0 ? '+' : ''}{Math.round(payloadRemainingKg)} kg
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(payloadStatus)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>Tare {fmt(effectiveTareKg)} + water {fmt(freshWaterMassKg + greyWaterMassKg)} + acc {fmt(accessoryMassKg)}</span>
        <span>ATM {fmt(atmLimitKg)}</span>
      </div>
    </div>
  );
}

function TowBallCard({ result }: { result: PhysicsResult }) {
  const { towBallDownloadKg, towBallDownloadLimitKg, towBallDownloadStatus, towBallPctOfAtm, towBallPctStatus } = result.vehicle;
  if (towBallDownloadKg == null || towBallDownloadLimitKg == null || towBallDownloadStatus == null) return null;

  const pct = clampPct(towBallDownloadKg, towBallDownloadLimitKg);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">Tow Ball Load</p>
          <p className="text-[10px] text-gray-400">Ball download force</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tabular-nums text-gray-800">{fmt(towBallDownloadKg)}</p>
          {towBallPctOfAtm != null && towBallPctStatus != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${towBallPctStatus === 'fail' ? 'text-red-600' : towBallPctStatus === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>
              {towBallPctOfAtm.toFixed(1)}% of ATM
            </p>
          )}
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(towBallDownloadStatus)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{fmt(towBallDownloadKg)}</span>
        <span>limit {fmt(towBallDownloadLimitKg)}</span>
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  sublabel: string;
  actual: number;
  limit: number;
  status: MetricStatus;
}

function MetricRow({ label, sublabel, actual, limit, status }: MetricRowProps) {
  const pct = clampPct(actual, limit);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 shrink-0">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400">{sublabel}</p>
      </div>
      <div className="relative flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(status)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right">
        <p className="text-xs tabular-nums text-gray-700">{fmt(actual)}</p>
        <p className="text-[10px] text-gray-400">/ {fmt(limit)}</p>
      </div>
    </div>
  );
}

function AxleGrid({ result }: { result: PhysicsResult }) {
  const v = result.vehicle;
  const rows: MetricRowProps[] = [
    { label: 'Rear Axle', sublabel: 'Rear axle load', actual: v.rearAxleKg, limit: v.rearAxleLimitKg, status: v.rearAxleStatus },
    { label: 'Front Axle', sublabel: 'Front axle load', actual: v.frontAxleKg, limit: v.frontAxleLimitKg, status: v.frontAxleStatus },
  ];
  if (v.gcmKg != null && v.gcmLimitKg != null && v.gcmStatus != null) {
    rows.push({ label: 'GCM', sublabel: 'Combined mass', actual: v.gcmKg, limit: v.gcmLimitKg, status: v.gcmStatus });
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Axle loads</p>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => <MetricRow key={r.label} {...r} />)}
      </div>
    </div>
  );
}

function RecommendationsPanel({ result }: { result: PhysicsResult }) {
  if (result.recommendations.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Recommendations</p>
        <p className="text-sm text-gray-400">No recommendations — rig looks good.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Recommendations</p>
      <div className="space-y-3">
        {result.recommendations.map((rec) => {
          const dot = rec.severity === 'critical' ? 'bg-red-500' : rec.severity === 'warn' ? 'bg-amber-400' : 'bg-blue-400';
          return (
            <div key={rec.id} className="flex gap-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-gray-700">{rec.title}</p>
                <p className="text-xs text-gray-500">{rec.body}</p>
              </div>
            </div>
          );
        })}
      </div>
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
        { label: 'Save', path: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
        { label: 'Share', path: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
        { label: 'PDF', path: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      ].map(({ label, path }) => (
        <button
          key={label}
          type="button"
          disabled
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 text-sm text-gray-400 cursor-not-allowed"
          style={{ minHeight: 44 }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={path} />
          </svg>
          {label}
        </button>
      ))}
    </div>
  );
}

function SheetResultsContent({ result }: { result: PhysicsResult }) {
  return (
    <>
      <VerdictBanner result={result} />
      <GvmBar result={result} />
      <PayloadCard result={result} />
      <TowBallCard result={result} />
      <AxleGrid result={result} />
      <RecommendationsPanel result={result} />
      <AdvancedPanel />
      <ActionBar />
    </>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onClose: () => void;
  result: PhysicsResult | null;
}

function ResultsSheet({ open, onClose, result }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [translateY, setTranslateY] = useState(0);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

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

  useEffect(() => {
    if (open) setTranslateY(0);
  }, [open]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Results"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-xl transition-transform duration-300 ease-out md:hidden"
        style={{
          height: '88vh',
          maxHeight: '88vh',
          transform: open ? `translateY(${translateY}px)` : 'translateY(100%)',
        }}
      >
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {result ? (
            <SheetResultsContent result={result} />
          ) : (
            <p className="text-sm text-gray-400 text-center mt-8">Loading results…</p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sticky bar ─────────────────────────────────────────────────────────────────

interface MobileResultsBarProps {
  vehicleSelected: boolean;
  result: PhysicsResult | null;
}

export function MobileResultsBar({ vehicleSelected, result }: MobileResultsBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const overallStatus = result?.overallStatus;
  const dotColor =
    overallStatus === 'pass' ? 'bg-green-500' :
    overallStatus === 'warn' ? 'bg-amber-400' :
    overallStatus === 'fail' ? 'bg-red-500' :
    'bg-gray-300';
  const barLabel =
    overallStatus === 'pass' ? 'All checks pass' :
    overallStatus === 'warn' ? 'Approaching limits' :
    overallStatus === 'fail' ? 'Over limit' :
    'Tap to view results';

  return (
    <>
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
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} aria-hidden="true" />
            <span className="text-sm text-gray-700">{barLabel}</span>
          </div>
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

      <ResultsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} result={result} />
    </>
  );
}
