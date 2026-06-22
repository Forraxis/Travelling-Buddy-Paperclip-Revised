'use client';

import type { ComplianceLimitKey } from '@/lib/physics/types';

// ─────────────────────────────────────────────────────────────────────────────
// "Help us verify" CTA — the crowdsourcing surface for a low-/no-confidence
// compliance limit. STUB ONLY: there is no verify backend yet, so onClick is a
// placeholder. Do not wire this to a service. All copy lives in ConfidenceBadge's
// CONFIDENCE_COPY (the `prompt` is passed in) so wording stays in one place.
// ─────────────────────────────────────────────────────────────────────────────

interface HelpVerifyCTAProps {
  /** Which compliance limit this CTA would help verify. */
  limitKey: ComplianceLimitKey;
  /** The soft-ask copy to show (sourced from CONFIDENCE_COPY). */
  prompt: string;
}

export function HelpVerifyCTA({ limitKey, prompt }: HelpVerifyCTAProps) {
  function handleClick() {
    // TODO(verify-backend): open the "confirm from your compliance placard"
    // flow for this limit. No backend exists yet — this is a placeholder.
    // limitKey identifies which figure the contribution would update.
    void limitKey;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-tb-accent hover:text-tb-accent-dark text-left text-[10px] leading-snug font-medium hover:underline"
    >
      {prompt} →
    </button>
  );
}
