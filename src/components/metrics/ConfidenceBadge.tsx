'use client';

import type { ComplianceLimitKey, LimitProvenance } from '@/lib/physics/types';
import { HelpVerifyCTA } from './HelpVerifyCTA';

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY-ONLY confidence layer. Renders a small per-metric confidence indicator
// from a compliance limit's provenance (status / confidence / source / as-of).
// It never reads or changes physics, gating, or the pass/fail verdict — it only
// surfaces how much we trust the *limit* a metric was checked against, and turns
// LOW/absent figures into a crowdsourcing ("help us verify") ask.
//
// Visual language is shared with the picker badge in
// src/components/calculator/picker/SearchTab.tsx (small rounded pill, text-[10px]
// font-semibold, soft bg + matching text colour).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ALL user-facing confidence copy lives here so it's trivial to tweak. Each
 * resolved "kind" maps to a badge label and (optionally) a soft CTA line.
 */
export const CONFIDENCE_COPY = {
  /** confidence HIGH — a manufacturer / published figure. No nag. */
  high: {
    label: 'Mfr spec',
    cta: null as string | null,
  },
  /** status CONFIRMED with no confidence — e.g. ROVER record or plate read. */
  confirmed: {
    label: 'Confirmed',
    cta: null as string | null,
  },
  /** confidence MEDIUM — a reasonable estimate; soft ask to confirm. */
  medium: {
    label: 'Estimate',
    cta: 'Confirm if you can',
  },
  /** status DISPUTED — sources disagree; treat with caution. */
  disputed: {
    label: 'Disputed',
    cta: 'Help us confirm the correct figure',
  },
  /**
   * confidence LOW or NO provenance at all — the empty-state flywheel ask. This
   * is the crowdsourcing prompt that turns a missing figure into a contribution.
   */
  unverified: {
    label: 'Unverified',
    cta: "We don't have a trusted figure yet — you could confirm this from your compliance placard for every owner.",
  },
} as const;

type ConfidenceKind = keyof typeof CONFIDENCE_COPY;

/** Tailwind pill styling per kind. Mirrors SearchTab BADGE_CONFIG conventions. */
const BADGE_CLASS: Record<ConfidenceKind, string> = {
  high: 'bg-green-100 text-green-700',
  confirmed: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  disputed: 'bg-red-100 text-red-700',
  unverified: 'bg-gray-100 text-gray-500',
};

/**
 * Collapse a limit's provenance into one display "kind". Order matters:
 *  - DISPUTED always wins (sources disagree).
 *  - HIGH confidence → mfr spec.
 *  - CONFIRMED status (no confidence) → confirmed (ROVER/plate).
 *  - MEDIUM confidence → estimate.
 *  - LOW confidence or undefined provenance → unverified (the flywheel ask).
 */
function resolveKind(prov: LimitProvenance | undefined): ConfidenceKind {
  if (!prov) return 'unverified';
  if (prov.status === 'DISPUTED') return 'disputed';
  if (prov.confidence === 'HIGH') return 'high';
  if (prov.status === 'CONFIRMED' && !prov.confidence) return 'confirmed';
  if (prov.confidence === 'MEDIUM') return 'medium';
  if (prov.confidence === 'LOW') return 'unverified';
  // CONFIRMED/ESTIMATE with no usable confidence signal: treat ESTIMATE as
  // medium, anything else as confirmed.
  return prov.status === 'ESTIMATE' ? 'medium' : 'confirmed';
}

/** Build the "sourced from {host} · as at {asOf}" tooltip, when we have data. */
function buildTitle(prov: LimitProvenance | undefined): string | undefined {
  if (!prov) return undefined;
  const parts: string[] = [];
  if (prov.sourceUrl) {
    let host = prov.sourceUrl;
    try {
      host = new URL(prov.sourceUrl).host;
    } catch {
      // Not a parseable absolute URL — fall back to the raw string.
    }
    parts.push(`sourced from ${host}`);
  }
  if (prov.asOf) parts.push(`as at ${prov.asOf}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

interface ConfidenceBadgeProps {
  /** The limit's provenance, or undefined when none is loaded for this key. */
  provenance: LimitProvenance | undefined;
  /** Which compliance limit this badge describes (for the verify CTA stub). */
  limitKey: ComplianceLimitKey;
  /** When true, render the soft CTA line under the badge (default true). */
  showCta?: boolean;
  /** When true, render ONLY the CTA (no pill) — for tight metric headers. */
  ctaOnly?: boolean;
  /** Extra classes on the wrapper. */
  className?: string;
}

/**
 * Small per-metric confidence indicator + optional "help us verify" CTA.
 * Degrades to the "Unverified — help us confirm" prompt when provenance is
 * absent, so it is always safe to render. Never crashes on missing data.
 */
export function ConfidenceBadge({
  provenance,
  limitKey,
  showCta = true,
  ctaOnly = false,
  className,
}: ConfidenceBadgeProps) {
  const kind = resolveKind(provenance);
  const copy = CONFIDENCE_COPY[kind];
  const title = buildTitle(provenance);
  const nags =
    kind === 'medium' || kind === 'disputed' || kind === 'unverified';
  const cta = (showCta || ctaOnly) && nags && copy.cta;

  // CTA-only mode: render nothing when there's no nag (high/confirmed limits).
  if (ctaOnly) {
    return cta ? (
      <span className={className}>
        <HelpVerifyCTA limitKey={limitKey} prompt={copy.cta!} />
      </span>
    ) : null;
  }

  return (
    <span
      className={`inline-flex flex-col items-start gap-0.5 ${className ?? ''}`}
    >
      <span
        className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${BADGE_CLASS[kind]}`}
        title={title}
      >
        {kind === 'unverified' ? 'Unverified — help us confirm' : copy.label}
      </span>
      {cta && <HelpVerifyCTA limitKey={limitKey} prompt={copy.cta!} />}
    </span>
  );
}
