'use client';

import { useState } from 'react';
import type {
  PhysicsResult,
  ComplianceLimitKey,
  LimitProvenance,
} from '@/lib/physics/types';
import { ConfidenceBadge } from './ConfidenceBadge';

// Itemised weight breakdown, raw axle loads + distribution, and per-axle caravan
// loads — the spec §7.4 "advanced" surface. Everything here is derived from the
// PhysicsResult, so it stays in sync with the headline metrics automatically.

function kg(n: number): string {
  // Uncomputable values (e.g. axle load with no wheelbase) show a dash, never "NaN".
  return Number.isFinite(n) ? `${Math.round(n).toLocaleString()} kg` : '—';
}

function Row({
  label,
  value,
  strong = false,
  limitKey,
  provenance,
}: {
  label: string;
  value: string;
  strong?: boolean;
  /** When set, render a confidence badge next to the label (display only). */
  limitKey?: ComplianceLimitKey;
  provenance?: LimitProvenance;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-xs ${strong ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {limitKey && (
          <ConfidenceBadge
            provenance={provenance}
            limitKey={limitKey}
            showCta={false}
          />
        )}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-tb-neutral-200 border-t px-4 py-3 first:border-t-0">
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function AdvancedPanel({ result }: { result: PhysicsResult }) {
  const [open, setOpen] = useState(false);
  const v = result.vehicle;
  const c = result.caravan;

  const axleTotal = v.frontAxleKg + v.rearAxleKg;
  const frontPct = axleTotal > 0 ? (v.frontAxleKg / axleTotal) * 100 : 0;
  const rearPct = axleTotal > 0 ? (v.rearAxleKg / axleTotal) * 100 : 0;

  return (
    <div className="border-tb-neutral-200 mb-4 rounded-lg border bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-tb-neutral-50 flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        aria-expanded={open}
      >
        Advanced — weight breakdown
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div>
          <Section title="Vehicle weight">
            <Row
              label="Kerb (incl. calibration)"
              value={kg(v.effectiveKerbKg)}
            />
            <Row label="Fuel" value={kg(v.fuelMassKg)} />
            <Row label="Passengers" value={kg(v.passengerMassKg)} />
            <Row label="Accessories" value={kg(v.accessoryMassKg)} />
            {v.towBallDownloadKg != null && (
              <Row label="Tow ball download" value={kg(v.towBallDownloadKg)} />
            )}
            <Row
              label="Total"
              value={`${kg(v.totalWeightKg)} / ${kg(v.gvmLimitKg)} GVM`}
              strong
            />
          </Section>

          <Section title="Axle distribution">
            <Row
              label="Front axle"
              value={`${kg(v.frontAxleKg)} (${Math.round(frontPct)}%) / ${kg(v.frontAxleLimitKg)}`}
              limitKey="frontAxle"
              provenance={v.limitProvenance?.frontAxle}
            />
            <Row
              label="Rear axle"
              value={`${kg(v.rearAxleKg)} (${Math.round(rearPct)}%) / ${kg(v.rearAxleLimitKg)}`}
              limitKey="rearAxle"
              provenance={v.limitProvenance?.rearAxle}
            />
            {v.gcmKg != null && v.gcmLimitKg != null && (
              <Row
                label="GCM"
                value={`${kg(v.gcmKg)} / ${kg(v.gcmLimitKg)}`}
                limitKey="gcm"
                provenance={v.limitProvenance?.gcm}
              />
            )}
          </Section>

          {c && (
            <Section title="Caravan weight">
              <Row
                label="Tare (incl. calibration)"
                value={kg(c.effectiveTareKg)}
              />
              <Row
                label="Water (fresh + grey)"
                value={kg(c.freshWaterMassKg + c.greyWaterMassKg)}
              />
              <Row label="Accessories" value={kg(c.accessoryMassKg)} />
              <Row
                label="Total"
                value={`${kg(c.totalWeightKg)} / ${kg(c.atmLimitKg)} ATM`}
                strong
              />
              <Row label="Tow ball mass" value={kg(c.towBallMassKg)} />
              <Row
                label="Axle group (GTM)"
                value={`${kg(c.gtmKg)} / ${kg(c.gtmLimitKg)}`}
              />
              {c.axles.length > 1 &&
                c.axles.map((a) => (
                  <Row
                    key={a.index}
                    label={`Axle ${a.index + 1} (${a.index === 0 ? 'front' : a.index === c.axles.length - 1 ? 'rear' : 'mid'})`}
                    value={`${kg(a.loadKg)} / ${kg(a.limitKg)}`}
                  />
                ))}
            </Section>
          )}

          <Section title="Methodology">
            <p className="text-[11px] leading-relaxed text-gray-500">
              Axle loads are computed by treating the vehicle as a beam on its
              two axles (longitudinal statics). Tow ball download is applied
              behind the rear axle, so it adds to the rear axle and lightens the
              front. Caravan tow ball mass is derived from where load sits
              relative to the van axle. Estimates only — confirm at a
              weighbridge.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
