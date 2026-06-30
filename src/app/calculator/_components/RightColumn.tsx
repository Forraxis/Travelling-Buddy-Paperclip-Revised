'use client';

import type {
  PhysicsResult,
  MetricStatus,
  ComplianceLimitKey,
  LimitProvenance,
} from '@/lib/physics/types';
import type { SchematicModel } from '@/components/schematic/model';
import SchematicViewer from '@/components/schematic/SchematicViewer';
import RigSchematic from '@/components/schematic/RigSchematic';
import { useCalcMode } from '@/modules/calculator/calc-mode';
import AdvancedPanel from '@/components/metrics/AdvancedPanel';
import { ConfidenceBadge } from '@/components/metrics/ConfidenceBadge';
import { WeighbridgeCalibrationPanel } from '@/components/calibration/WeighbridgeCalibrationPanel';
import { SetupVersionsPanel } from '@/components/versions/SetupVersionsPanel';
import { PlateConfirmCTA } from './PlateConfirmCTA';

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusColor(status: MetricStatus): string {
  if (status === 'fail') return 'bg-red-500';
  if (status === 'warn') return 'bg-amber-400';
  return 'bg-green-500';
}

function statusBadgeColor(status: MetricStatus): string {
  if (status === 'fail') return 'bg-red-100 text-red-700';
  if (status === 'warn') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function clampPct(val: number, limit: number): number {
  const pct = (val / limit) * 100;
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
}

function fmt(kg: number): string {
  // Missing geometry (e.g. no wheelbase) makes an axle load uncomputable — show a
  // clean dash, never "NaN".
  return Number.isFinite(kg) ? `${Math.round(kg).toLocaleString()} kg` : '—';
}

/** A metric value we couldn't compute (non-finite) — e.g. axle load with no wheelbase. */
function isUnavailable(v: number | null | undefined): boolean {
  return v == null || !Number.isFinite(v);
}

/**
 * Metrics that need catalogue data the variant may lack (wheelbase → axles, kerb
 * → GVM total, caravan geometry → tow ball). Used to soften a "pass" that
 * couldn't actually check everything. Display-only — overallStatus is unchanged.
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

// ── Empty state ────────────────────────────────────────────────────────────────

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
      <rect x="2" y="20" width="42" height="24" rx="4" fill="#e5e7eb" />
      <rect x="8" y="12" width="28" height="12" rx="3" fill="#d1d5db" />
      <rect x="11" y="14" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <rect x="23" y="14" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <circle cx="14" cy="45" r="6" fill="#9ca3af" />
      <circle cx="14" cy="45" r="3" fill="#e5e7eb" />
      <circle cx="34" cy="45" r="6" fill="#9ca3af" />
      <circle cx="34" cy="45" r="3" fill="#e5e7eb" />
      <rect x="44" y="30" width="12" height="3" rx="1.5" fill="#9ca3af" />
      <rect x="54" y="18" width="38" height="26" rx="4" fill="#e5e7eb" />
      <rect x="60" y="23" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <rect x="74" y="23" width="10" height="8" rx="1.5" fill="#f9fafb" />
      <rect x="83" y="28" width="6" height="14" rx="1" fill="#d1d5db" />
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
      <p className="text-tb-primary text-base font-medium">
        Select your vehicle to get started
      </p>
      <p className="mt-1 text-sm text-gray-400">
        Your compliance results will appear here once a vehicle is configured.
      </p>
    </div>
  );
}

// ── Loading skeleton (vehicle selected but fetch not yet complete) ──────────────

function SkeletonBar({ widthClass = 'w-1/3' }: { widthClass?: string }) {
  return <div className={`bg-tb-neutral-200 h-2 rounded-full ${widthClass}`} />;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="bg-tb-neutral-200 rounded-md px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gray-300" />
          <SkeletonBar widthClass="w-40" />
        </div>
        <SkeletonBar widthClass="w-56 mt-2" />
      </div>
      <div className="border-tb-neutral-200 space-y-3 rounded-lg border bg-white p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-24 space-y-1">
              <SkeletonBar widthClass="w-16" />
              <SkeletonBar widthClass="w-12" />
            </div>
            <div className="bg-tb-neutral-200 h-3 flex-1 rounded-full" />
            <SkeletonBar widthClass="w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Verdict banner ─────────────────────────────────────────────────────────────

function VerdictBanner({ result }: { result: PhysicsResult }) {
  const { overallStatus } = result;
  // Some metrics need catalogue data the variant may lack (wheelbase → axles,
  // kerb → GVM total, caravan geometry → tow ball). Don't let the banner claim a
  // confident "all pass" while those rows show "—".
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
    ? 'bg-tb-primary-lighter border-tb-neutral-200'
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

// ── GVM progress bar ────────────────────────────────────────────────────────────

function GvmBar({ result }: { result: PhysicsResult }) {
  const { totalWeightKg, gvmLimitKg, gvmStatus } = result.vehicle;
  const pct = clampPct(totalWeightKg, gvmLimitKg);

  return (
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
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
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeColor(gvmStatus)}`}
        >
          {isUnavailable(totalWeightKg) ? '—' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="bg-tb-neutral-200 relative h-3 overflow-hidden rounded-full">
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

// ── Metric row ─────────────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  sublabel: string;
  actual: number;
  limit: number;
  status: MetricStatus;
  /** Verdict honesty: limit comes from an unverified source — show a caveat. */
  estimated?: boolean;
  /** Compliance limit this row checks against (for the confidence badge). */
  limitKey: ComplianceLimitKey;
  provenance?: LimitProvenance;
}

function MetricRow({
  label,
  sublabel,
  actual,
  limit,
  status,
  limitKey,
  provenance,
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
      </div>
      {unavailable ? (
        <p className="flex-1 text-[11px] text-gray-400 italic">
          Add this vehicle’s wheelbase to estimate the axle load.
        </p>
      ) : (
        <div className="bg-tb-neutral-200 relative h-3 flex-1 overflow-hidden rounded-full">
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

/** Is a given compliance limit flagged estimated on this result? */
function isLimitEstimated(
  result: PhysicsResult,
  key: ComplianceLimitKey,
): boolean {
  return result.vehicle.estimatedLimits?.includes(key) ?? false;
}

// ── Axle metrics grid ──────────────────────────────────────────────────────────

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
      estimated: isLimitEstimated(result, 'rearAxle'),
      limitKey: 'rearAxle',
      provenance: prov?.rearAxle,
    },
    {
      label: 'Front Axle',
      sublabel: 'Front axle load',
      actual: v.frontAxleKg,
      limit: v.frontAxleLimitKg,
      status: v.frontAxleStatus,
      estimated: isLimitEstimated(result, 'frontAxle'),
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
      estimated: isLimitEstimated(result, 'gcm'),
      limitKey: 'gcm',
      provenance: prov?.gcm,
    });
  }

  return (
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        Axle loads
      </p>
      <div className="divide-tb-neutral-200 divide-y">
        {rows.map((r) => (
          <MetricRow key={r.label} {...r} />
        ))}
      </div>
    </div>
  );
}

// ── Payload remaining ──────────────────────────────────────────────────────────

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
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
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
          <div className="bg-tb-neutral-200 relative h-3 overflow-hidden rounded-full">
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

// ── Tow ball load ──────────────────────────────────────────────────────────────

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
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
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
      <div className="bg-tb-neutral-200 relative h-3 overflow-hidden rounded-full">
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

// ── Recommendations ────────────────────────────────────────────────────────────

function RecommendationsPanel({ result }: { result: PhysicsResult }) {
  if (result.recommendations.length === 0) {
    return (
      <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Recommendations
        </p>
        <p className="text-sm text-gray-400">
          No recommendations — rig looks good.
        </p>
      </div>
    );
  }

  return (
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
        Recommendations
      </p>
      <div className="space-y-3">
        {result.recommendations.map((rec) => {
          const dotColor =
            rec.severity === 'critical'
              ? 'bg-red-500'
              : rec.severity === 'warn'
                ? 'bg-amber-400'
                : 'bg-blue-400';
          return (
            <div key={rec.id} className="flex gap-2">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  {rec.title}
                </p>
                <p className="text-xs text-gray-500">{rec.body}</p>
                {rec.actions && rec.actions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {rec.actions.map((a, i) => {
                      const href =
                        a.type === 'internal_link' && a.payload
                          ? a.payload
                          : '/accessories/';
                      return (
                        <a
                          key={i}
                          href={href}
                          className="text-tb-accent hover:text-tb-accent-dark text-xs font-semibold hover:underline"
                        >
                          {a.label} →
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Action bar ─────────────────────────────────────────────────────────────────

function ActionBar() {
  return (
    <div className="border-tb-neutral-200 mt-auto flex gap-2 border-t bg-white pt-4">
      {[
        {
          label: 'Save',
          path: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
        },
        {
          label: 'Share',
          path: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
        },
        {
          label: 'PDF',
          path: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        },
      ].map(({ label, path }) => (
        <button
          key={label}
          type="button"
          disabled
          className="border-tb-neutral-200 flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm text-gray-400"
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

// ── Stability (advisory CoG height + SSF) ───────────────────────────────────────

function StabilityCard({ result }: { result: PhysicsResult }) {
  const s = result.vehicle.stability;
  if (!s) return null;
  const label =
    s.status === 'ok'
      ? 'Stable'
      : s.status === 'warn'
        ? 'Tall — take it easy'
        : 'Top-heavy — high rollover risk';
  return (
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Stability
        </p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
          Advisory
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${statusColor(s.status)}`}
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-gray-800">{label}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <span className="text-gray-600">
          CoG height:{' '}
          <span className="font-mono font-semibold text-gray-800">
            {(s.cogHeightMm / 1000).toFixed(2)} m
          </span>
        </span>
        <span className="text-gray-600">
          Stability factor:{' '}
          <span className="font-mono font-semibold text-gray-800">
            {s.ssf.toFixed(2)}
          </span>
        </span>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Static Stability Factor = half-track ÷ centre-of-gravity height; higher
        is more rollover-resistant. Advisory estimate from load heights — it
        does not change the pass/fail verdict.
      </p>
    </div>
  );
}

// ── Results view ───────────────────────────────────────────────────────────────

function ResultsView({
  result,
  schematic,
}: {
  result: PhysicsResult;
  schematic?: SchematicModel | null;
}) {
  const { mode } = useCalcMode();
  const advanced = mode === 'advanced';
  return (
    <>
      <VerdictBanner result={result} />
      <PlateConfirmCTA result={result} />
      {/* Advanced gets the interactive schematic (positioning, customise, top-down);
          Simple gets a clean read-only side profile. */}
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
      {advanced && (
        <>
          <StabilityCard result={result} />
          <div className="mb-4">
            <WeighbridgeCalibrationPanel />
          </div>
          <div className="mb-4">
            <SetupVersionsPanel />
          </div>
        </>
      )}
      <RecommendationsPanel result={result} />
      {advanced && <AdvancedPanel result={result} />}
      <ActionBar />
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

interface RightColumnProps {
  vehicleSelected?: boolean;
  result: PhysicsResult | null;
  schematic?: SchematicModel | null;
}

export default function RightColumn({
  vehicleSelected = false,
  result,
  schematic,
}: RightColumnProps) {
  return (
    <div className="md:border-tb-neutral-200 hidden md:flex md:w-[45%] md:flex-none md:flex-col md:border-l md:bg-white lg:w-[40%]">
      <div className="sticky top-0 flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto px-4 py-6">
        {!vehicleSelected ? (
          <EmptyState />
        ) : result ? (
          <ResultsView result={result} schematic={schematic} />
        ) : (
          <LoadingState />
        )}
      </div>
    </div>
  );
}
