'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  PhysicsResult,
  MetricStatus,
  ComplianceLimitKey,
  LimitProvenance,
} from '@/lib/physics/types';
import type { SchematicModel } from '@/components/schematic/model';
import SchematicViewer from '@/components/schematic/SchematicViewer';
import RigSchematic from '@/components/schematic/RigSchematic';
import AdvancedPanel from '@/components/metrics/AdvancedPanel';
import { ConfidenceBadge } from '@/components/metrics/ConfidenceBadge';
import { useCalcMode } from '@/modules/calculator/calc-mode';
import { PlateConfirmCTA } from './PlateConfirmCTA';

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColor(status: MetricStatus): string {
  if (status === 'fail') return 'bg-red-500';
  if (status === 'warn') return 'bg-amber-400';
  return 'bg-green-500';
}

function clampPct(val: number, limit: number): number {
  const pct = (val / limit) * 100;
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
}

function fmt(kg: number): string {
  // Uncomputable values (e.g. axle load with no wheelbase) show a dash, never "NaN".
  return Number.isFinite(kg) ? `${Math.round(kg).toLocaleString()} kg` : '—';
}

/** A metric value we couldn't compute (non-finite) — e.g. axle load with no wheelbase. */
function isUnavailable(v: number | null | undefined): boolean {
  return v == null || !Number.isFinite(v);
}

/** Percentage text that shows a clean dash when the underlying value is uncomputable. */
function pctText(val: number, limit: number): string {
  return isUnavailable(val) || isUnavailable(limit) || limit === 0
    ? '—'
    : `${Math.round(clampPct(val, limit))}%`;
}

/**
 * Metrics that need catalogue data we may lack (wheelbase → axles, kerb → GVM
 * total, caravan geometry → tow ball). A "pass" while any of these is "—" hasn't
 * actually checked everything, so we soften the verdict rather than claim a
 * confident green. Display-only — overallStatus is unchanged.
 */
function hasUncheckedMetrics(result: PhysicsResult): boolean {
  const v = result.vehicle;
  return (
    isUnavailable(v.frontAxleKg) ||
    isUnavailable(v.rearAxleKg) ||
    isUnavailable(v.totalWeightKg) ||
    (result.caravan != null && isUnavailable(v.towBallDownloadKg))
  );
}

// ── Sheet content ──────────────────────────────────────────────────────────────

function VerdictBanner({ result }: { result: PhysicsResult }) {
  const { overallStatus } = result;
  const passWithGaps = overallStatus === 'pass' && hasUncheckedMetrics(result);
  const label =
    overallStatus === 'pass'
      ? passWithGaps
        ? 'Within all checked limits'
        : 'All checks pass'
      : overallStatus === 'warn'
        ? 'Approaching limits'
        : 'Over limit';
  const sub =
    overallStatus === 'pass'
      ? passWithGaps
        ? 'Some limits couldn’t be checked — confirm the figures marked “—” to complete them.'
        : 'Your rig is within all compliance limits.'
      : overallStatus === 'warn'
        ? 'One or more metrics are approaching their limit.'
        : 'One or more limits are exceeded. Adjust your load.';
  const dot = passWithGaps
    ? 'bg-tb-primary-light'
    : overallStatus === 'pass'
      ? 'bg-green-500'
      : overallStatus === 'warn'
        ? 'bg-amber-400'
        : 'bg-red-500';
  const bg = passWithGaps
    ? 'bg-tb-primary-lighter border-gray-200'
    : overallStatus === 'pass'
      ? 'bg-green-50 border-green-200'
      : overallStatus === 'warn'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200';

  return (
    <div className={`mb-4 rounded-md border px-4 py-3 ${bg}`}>
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${dot}`}
          aria-hidden="true"
        />
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
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-700">GVM</p>
            <ConfidenceBadge
              provenance={result.vehicle.limitProvenance?.gvm}
              limitKey="gvm"
              showCta={false}
            />
          </div>
          <p className="text-[10px] text-gray-400">Gross Vehicle Mass</p>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          {pctText(totalWeightKg, gvmLimitKg)}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(gvmStatus)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{fmt(totalWeightKg)}</span>
        <span>limit {fmt(gvmLimitKg)}</span>
      </div>
      <ConfidenceBadge
        provenance={result.vehicle.limitProvenance?.gvm}
        limitKey="gvm"
        ctaOnly
        className="mt-1.5 block"
      />
    </div>
  );
}

function PayloadCard({ result }: { result: PhysicsResult }) {
  if (!result.caravan) return null;
  const {
    payloadRemainingKg,
    payloadStatus,
    atmLimitKg,
    effectiveTareKg,
    accessoryMassKg,
    freshWaterMassKg,
    greyWaterMassKg,
  } = result.caravan;
  // Without a known ATM we can't compute headroom — don't show a bogus negative
  // payload against a 0 limit.
  const atmUnknown = isUnavailable(atmLimitKg) || atmLimitKg <= 0;
  const usedKg = atmLimitKg - payloadRemainingKg;
  const pct = clampPct(usedKg, atmLimitKg);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">
            Payload Remaining
          </p>
          <p className="text-[10px] text-gray-400">Caravan ATM headroom</p>
        </div>
        {atmUnknown ? (
          <p className="text-sm font-bold text-gray-400 tabular-nums">—</p>
        ) : (
          <p
            className={`text-sm font-bold tabular-nums ${payloadRemainingKg < 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {payloadRemainingKg >= 0 ? '+' : ''}
            {Math.round(payloadRemainingKg)} kg
          </p>
        )}
      </div>
      {atmUnknown ? (
        <p className="text-[11px] text-gray-400 italic">
          Add this caravan’s ATM to check payload headroom.
        </p>
      ) : (
        <>
          <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(payloadStatus)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-gray-400">
            <span>
              Tare {fmt(effectiveTareKg)} + water{' '}
              {fmt(freshWaterMassKg + greyWaterMassKg)} + acc{' '}
              {fmt(accessoryMassKg)}
            </span>
            <span>ATM {fmt(atmLimitKg)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function TowBallCard({ result }: { result: PhysicsResult }) {
  const {
    towBallDownloadKg,
    towBallDownloadLimitKg,
    towBallDownloadStatus,
    towBallPctOfAtm,
    towBallPctStatus,
  } = result.vehicle;
  if (
    towBallDownloadKg == null ||
    towBallDownloadLimitKg == null ||
    towBallDownloadStatus == null
  )
    return null;

  const pct = clampPct(towBallDownloadKg, towBallDownloadLimitKg);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-gray-700">Tow Ball Load</p>
            <ConfidenceBadge
              provenance={result.vehicle.limitProvenance?.towBall}
              limitKey="towBall"
              showCta={false}
            />
          </div>
          <p className="text-[10px] text-gray-400">Ball download force</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-800 tabular-nums">
            {fmt(towBallDownloadKg)}
          </p>
          {towBallPctOfAtm != null &&
            Number.isFinite(towBallPctOfAtm) &&
            towBallPctStatus != null && (
              <p
                className={`text-[10px] font-semibold tabular-nums ${towBallPctStatus === 'fail' ? 'text-red-600' : towBallPctStatus === 'warn' ? 'text-amber-600' : 'text-green-600'}`}
              >
                {towBallPctOfAtm.toFixed(1)}% of ATM
              </p>
            )}
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(towBallDownloadStatus)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{fmt(towBallDownloadKg)}</span>
        <span>limit {fmt(towBallDownloadLimitKg)}</span>
      </div>
      <ConfidenceBadge
        provenance={result.vehicle.limitProvenance?.towBall}
        limitKey="towBall"
        ctaOnly
        className="mt-1.5 block"
      />
    </div>
  );
}

interface MetricRowProps {
  label: string;
  sublabel: string;
  actual: number;
  limit: number;
  status: MetricStatus;
  /** Compliance limit this row checks against (for the confidence badge). */
  limitKey: ComplianceLimitKey;
  provenance?: LimitProvenance;
  /** Shown when the value is uncomputable; defaults to the axle/wheelbase note. */
  unavailableNote?: string;
}

function MetricRow({
  label,
  sublabel,
  actual,
  limit,
  status,
  limitKey,
  provenance,
  unavailableNote = 'Add this vehicle’s wheelbase to estimate the axle load.',
}: MetricRowProps) {
  const unavailable = isUnavailable(actual);
  const pct = clampPct(actual, limit);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 shrink-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold text-gray-700">{label}</p>
          {!unavailable && (
            <ConfidenceBadge
              provenance={provenance}
              limitKey={limitKey}
              showCta={false}
            />
          )}
        </div>
        <p className="text-[10px] text-gray-400">{sublabel}</p>
        {!unavailable && (
          <ConfidenceBadge
            provenance={provenance}
            limitKey={limitKey}
            ctaOnly
            className="mt-0.5 block"
          />
        )}
      </div>
      {unavailable ? (
        <p className="flex-1 text-[11px] text-gray-400 italic">
          {unavailableNote}
        </p>
      ) : (
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${statusColor(status)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="w-20 shrink-0 text-right">
        <p className="text-xs text-gray-700 tabular-nums">{fmt(actual)}</p>
        <p className="text-[10px] text-gray-400">/ {fmt(limit)}</p>
      </div>
    </div>
  );
}

function AxleGrid({ result }: { result: PhysicsResult }) {
  const v = result.vehicle;
  const prov = v.limitProvenance;
  const rows: MetricRowProps[] = [
    {
      label: 'Rear Axle',
      sublabel: 'Rear axle load',
      actual: v.rearAxleKg,
      limit: v.rearAxleLimitKg,
      status: v.rearAxleStatus,
      limitKey: 'rearAxle',
      provenance: prov?.rearAxle,
    },
    {
      label: 'Front Axle',
      sublabel: 'Front axle load',
      actual: v.frontAxleKg,
      limit: v.frontAxleLimitKg,
      status: v.frontAxleStatus,
      limitKey: 'frontAxle',
      provenance: prov?.frontAxle,
    },
  ];
  if (v.gcmKg != null && v.gcmLimitKg != null && v.gcmStatus != null) {
    rows.push({
      label: 'GCM',
      sublabel: 'Combined mass',
      actual: v.gcmKg,
      limit: v.gcmLimitKg,
      status: v.gcmStatus,
      limitKey: 'gcm',
      provenance: prov?.gcm,
      unavailableNote:
        'Add this vehicle’s kerb weight to estimate combined mass.',
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        Axle loads
      </p>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <MetricRow key={r.label} {...r} />
        ))}
      </div>
    </div>
  );
}

function RecommendationsPanel({ result }: { result: PhysicsResult }) {
  if (result.recommendations.length === 0) {
    const gaps = hasUncheckedMetrics(result);
    return (
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Recommendations
        </p>
        <p className="text-sm text-gray-400">
          {gaps
            ? 'No issues with the figures we could check — confirm the metrics marked “—” for the full picture.'
            : 'No recommendations — rig looks good.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        Recommendations
      </p>
      <div className="space-y-3">
        {result.recommendations.map((rec) => {
          const dot =
            rec.severity === 'critical'
              ? 'bg-red-500'
              : rec.severity === 'warn'
                ? 'bg-amber-400'
                : 'bg-blue-400';
          return (
            <div key={rec.id} className="flex gap-2">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  {rec.title}
                </p>
                <p className="text-xs text-gray-500">{rec.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ActionBarProps {
  onSave?: () => void;
  onShare?: () => void;
  saving?: boolean;
}

function ActionBar({ onSave, onShare, saving }: ActionBarProps) {
  const actions = [
    {
      label: saving ? 'Saving…' : 'Save',
      path: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      onClick: onSave,
      disabled: saving,
    },
    {
      label: 'Share',
      path: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
      onClick: onShare,
      disabled: false,
    },
    {
      label: 'PDF',
      path: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      onClick: undefined,
      disabled: true,
    },
  ];

  return (
    <div className="flex gap-2 border-t border-gray-200 bg-white pt-4 pb-2">
      {actions.map(({ label, path, onClick, disabled }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={disabled || !onClick}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors ${
            disabled || !onClick
              ? 'cursor-not-allowed border-gray-200 text-gray-400'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          style={{ minHeight: 44 }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={path} />
          </svg>
          {label}
        </button>
      ))}
    </div>
  );
}

interface SheetResultsContentProps {
  result: PhysicsResult;
  schematic?: SchematicModel | null;
  onSave?: () => void;
  onShare?: () => void;
  saving?: boolean;
}

function SheetResultsContent({
  result,
  schematic,
  onSave,
  onShare,
  saving,
}: SheetResultsContentProps) {
  const { mode } = useCalcMode();
  const advanced = mode === 'advanced';
  return (
    <>
      <VerdictBanner result={result} />
      <PlateConfirmCTA result={result} />
      {schematic &&
        (advanced ? (
          <SchematicViewer model={schematic} />
        ) : (
          <RigSchematic model={schematic} />
        ))}
      <GvmBar result={result} />
      <PayloadCard result={result} />
      <TowBallCard result={result} />
      <AxleGrid result={result} />
      <RecommendationsPanel result={result} />
      {advanced && <AdvancedPanel result={result} />}
      <ActionBar onSave={onSave} onShare={onShare} saving={saving} />
    </>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  onClose: () => void;
  result: PhysicsResult | null;
  schematic?: SchematicModel | null;
  onSave?: () => void;
  onShare?: () => void;
  saving?: boolean;
}

function ResultsSheet({
  open,
  onClose,
  result,
  schematic,
  onSave,
  onShare,
  saving,
}: SheetProps) {
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
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
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
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {result ? (
            <SheetResultsContent
              result={result}
              schematic={schematic}
              onSave={onSave}
              onShare={onShare}
              saving={saving}
            />
          ) : (
            <p className="mt-8 text-center text-sm text-gray-400">
              Loading results…
            </p>
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
  schematic?: SchematicModel | null;
  onSave?: () => void;
  onShare?: () => void;
  saving?: boolean;
}

export function MobileResultsBar({
  vehicleSelected,
  result,
  schematic,
  onSave,
  onShare,
  saving,
}: MobileResultsBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const overallStatus = result?.overallStatus;
  const passWithGaps =
    overallStatus === 'pass' && result != null && hasUncheckedMetrics(result);
  const dotColor = passWithGaps
    ? 'bg-tb-primary-light'
    : overallStatus === 'pass'
      ? 'bg-green-500'
      : overallStatus === 'warn'
        ? 'bg-amber-400'
        : overallStatus === 'fail'
          ? 'bg-red-500'
          : 'bg-gray-300';
  const barLabel =
    overallStatus === 'pass'
      ? passWithGaps
        ? 'Within checked limits'
        : 'All checks pass'
      : overallStatus === 'warn'
        ? 'Approaching limits'
        : overallStatus === 'fail'
          ? 'Over limit'
          : 'Tap to view results';

  // Key metric for quick glance on the sticky bar — omitted when uncomputable.
  const gvmRatio = result
    ? (result.vehicle.totalWeightKg / result.vehicle.gvmLimitKg) * 100
    : NaN;
  const gvmPct =
    result?.vehicle.gvmStatus && Number.isFinite(gvmRatio)
      ? Math.round(gvmRatio)
      : null;

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-30 transition-all duration-300 ease-out md:hidden ${
          vehicleSelected
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-full opacity-0'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Verdict banner strip — visible at a glance */}
        <div
          className={`border-t px-4 py-2 ${
            passWithGaps
              ? 'bg-tb-primary-lighter border-gray-200'
              : overallStatus === 'pass'
                ? 'border-green-200 bg-green-50'
                : overallStatus === 'warn'
                  ? 'border-amber-200 bg-amber-50'
                  : overallStatus === 'fail'
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${dotColor}`}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-gray-800">
                {barLabel}
              </span>
            </div>
            {gvmPct !== null && (
              <span className="text-xs font-medium text-gray-600">
                GVM {gvmPct}%
              </span>
            )}
          </div>
        </div>

        {/* Tap handle to open full sheet */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-between border-t border-gray-200 bg-white px-4 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
          style={{ height: 52, minHeight: 44 }}
          aria-label="View results"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <span className="text-xs text-gray-500">
            Tap for axle loads, tow ball, details
          </span>
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>
      </div>

      <ResultsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        result={result}
        schematic={schematic}
        onSave={onSave}
        onShare={onShare}
        saving={saving}
      />
    </>
  );
}
