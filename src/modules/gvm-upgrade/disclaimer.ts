/**
 * P8 — GVM-upgrade disclaimer (the §6 stamp).
 *
 * Rule 11: a GVM upgrade changes a compliance VERDICT (it raises the limits the
 * pass/fail math tests against). The physics overlay stays behind
 * `GVM_UPGRADE_ENABLED` + advisory until Tim signs it off, and ANY surface that
 * shows upgraded limits must carry this disclaimer near the figures. This is a
 * planning tool, not certification — confirm against your compliance plate /
 * engineer cert.
 *
 * The "current as of" stamp is deterministic (toISOString().slice(0,10)) so the
 * text never depends on the viewer's locale.
 */

export const GVM_UPGRADE_DISCLAIMER =
  'GVM-upgrade figures are advisory only and not legal advice. This is a ' +
  'planning estimate — always confirm the certified limits against your ' +
  "vehicle's compliance plate or your engineer / second-stage-manufacturer " +
  'certificate before towing. State recognition of an upgrade can differ from ' +
  'where it was certified.';

/** A short inline tag for use beside an individual upgraded figure. */
export const GVM_UPGRADE_ESTIMATE_TAG = 'Est. — confirm your plate';

/**
 * "Current as of {YYYY-MM-DD}" stamp. Deterministic; pass a fixed date in tests.
 */
export function gvmUpgradeDisclaimerAsOf(now: Date = new Date()): string {
  return `Current as of ${now.toISOString().slice(0, 10)}.`;
}
