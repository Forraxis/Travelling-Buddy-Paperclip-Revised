/**
 * State GVM-upgrade cap rules — pure validator (OVERNIGHT_BUILD_FULL.md Phase P6).
 *
 * Several states cap how far a GVM upgrade may raise a vehicle's factory GVM. The
 * common form is **"lower of +X kg or +Y% of base GVM"** (QLD: lower of +300 kg or
 * +10%). This module is the *pure* core that, given the base GVM, the proposed delta,
 * the user's state and the seeded cap data, decides whether the upgrade is within
 * spec — and which limb of the rule governs.
 *
 * RULE 11 / ADVISORY: this NEVER changes a compliance verdict on its own. It produces
 * an advisory `{ withinSpec, capKg, governedBy }` result the UI surfaces as guidance
 * ("QLD: lower of +300/+10% → your +280 is within spec ✓") plus an interstate-
 * recognition warning. The seeded `RegulationSet` entries are marked UNSIGNED until
 * Tim ticks the actual numbers per state. No DB, no clock here — deterministic + tested.
 *
 * Federal note: the Commonwealth (pre-rego second-stage / SSM) path has no fixed
 * "+X/+Y%" ceiling — the limit is whatever the second-stage manufacturer/engineer
 * certifies — so the Federal cap record carries `unlimited: true` and always reports
 * `withinSpec` with `governedBy: 'NONE'`. State engineer-cert caps carry the numeric
 * limbs.
 */

import type { AustralianState } from '@prisma/client';

/**
 * One state's GVM-upgrade cap. Either an explicit `{ addKg, percentOfBase }` pair (the
 * "lower of +X kg / +Y%" form) or `unlimited` (no fixed ceiling — certifier governs).
 * `signedOff` mirrors the Rule-11 gate: until Tim ticks the numbers it stays false and
 * the result is advisory-only.
 */
export interface GvmCapRule {
  /** Absolute mass headroom in kg (the "+X kg" limb). Omitted when `unlimited`. */
  addKg?: number;
  /** Percentage of the base GVM (the "+Y%" limb, e.g. 10 = +10%). Omitted when `unlimited`. */
  percentOfBase?: number;
  /** No fixed ceiling — the certifying authority sets the limit (e.g. Federal SSM). */
  unlimited?: boolean;
  /** Human label for the rule, e.g. "lower of +300 kg or +10%". */
  label: string;
  /** Rule-11: false until Tim signs the actual numbers. Advisory regardless. */
  signedOff: boolean;
}

/** Which limb of the "lower of" rule set the cap. */
export type GvmCapGovernor = 'ADD_KG' | 'PERCENT' | 'NONE';

export interface GvmCapResult {
  /** Whether the proposed delta is within the state's cap. */
  withinSpec: boolean;
  /** The effective cap in kg (the lower of the two limbs). `null` when unlimited. */
  capKg: number | null;
  /** Which limb governed the cap (the lower one), or NONE when unlimited. */
  governedBy: GvmCapGovernor;
  /** The cap rule's human label, echoed for UI. */
  label: string;
  /** Mirror of the rule's sign-off flag — advisory until true. */
  signedOff: boolean;
  /** The proposed delta, echoed for convenience. */
  deltaKg: number;
}

/**
 * The seeded cap data, keyed by state (plus a synthetic `FEDERAL` entry). Callers load
 * this from the `RegulationSet`/`Version` seed (see `seed-gvm-caps-local.ts`) and pass
 * the relevant rule in. We accept the whole map OR a single rule for flexibility.
 */
export type GvmCapData = Partial<
  Record<AustralianState | 'FEDERAL', GvmCapRule>
>;

/**
 * Validate a proposed GVM-upgrade delta against a state cap.
 *
 * @param baseGvm  Factory GVM (kg) of the base vehicle.
 * @param deltaKg  Proposed increase (kg) over the factory GVM (upgradedGvm - baseGvm).
 * @param state    The state whose cap governs (the certifying / home state).
 * @param capData  Seeded cap data (a state→rule map, or a single rule).
 *
 * Returns an advisory `{ withinSpec, capKg, governedBy, label, signedOff, deltaKg }`.
 * If no rule exists for the state, treats it as unlimited (within spec, NONE) — we
 * don't fail-closed on missing data, the absence is surfaced via `signedOff: false`.
 */
export function validateGvmUpgradeAgainstCap(
  baseGvm: number,
  deltaKg: number,
  state: AustralianState | 'FEDERAL',
  capData: GvmCapData | GvmCapRule,
): GvmCapResult {
  const rule: GvmCapRule | undefined = isCapRule(capData)
    ? capData
    : capData[state];

  // No rule for this state, or an explicit unlimited rule → no fixed ceiling.
  if (!rule || rule.unlimited) {
    return {
      withinSpec: true,
      capKg: null,
      governedBy: 'NONE',
      label: rule?.label ?? 'no fixed cap',
      signedOff: rule?.signedOff ?? false,
      deltaKg,
    };
  }

  const addKg = rule.addKg;
  const percentKg =
    rule.percentOfBase != null
      ? (baseGvm * rule.percentOfBase) / 100
      : undefined;

  // The cap is the LOWER of the two limbs that are present.
  let capKg: number;
  let governedBy: GvmCapGovernor;
  if (addKg != null && percentKg != null) {
    if (percentKg < addKg) {
      capKg = percentKg;
      governedBy = 'PERCENT';
    } else {
      capKg = addKg;
      governedBy = 'ADD_KG';
    }
  } else if (percentKg != null) {
    capKg = percentKg;
    governedBy = 'PERCENT';
  } else if (addKg != null) {
    capKg = addKg;
    governedBy = 'ADD_KG';
  } else {
    // A numeric rule with neither limb set — treat as unlimited rather than throw.
    return {
      withinSpec: true,
      capKg: null,
      governedBy: 'NONE',
      label: rule.label,
      signedOff: rule.signedOff,
      deltaKg,
    };
  }

  return {
    withinSpec: deltaKg <= capKg,
    capKg,
    governedBy,
    label: rule.label,
    signedOff: rule.signedOff,
    deltaKg,
  };
}

/**
 * Interstate-recognition warning. A GVM upgrade certified in one state is not always
 * recognised in another (the legal status of a second-stage/engineer cert can differ
 * across borders). When the user's home state differs from the state the upgrade was
 * certified in, return an advisory warning string; otherwise null.
 */
export function interstateRecognitionWarning(
  homeState: AustralianState | null | undefined,
  certifiedState: AustralianState | null | undefined,
): string | null {
  if (!homeState || !certifiedState) return null;
  if (homeState === certifiedState) return null;
  return (
    `This GVM upgrade was certified in ${certifiedState} but you register in ` +
    `${homeState}. Interstate recognition of GVM upgrades is not guaranteed — ` +
    `confirm acceptance with ${homeState} before relying on the upgraded limits.`
  );
}

/** Type guard: a single rule vs. a state→rule map. */
function isCapRule(value: GvmCapData | GvmCapRule): value is GvmCapRule {
  return (
    typeof (value as GvmCapRule).label === 'string' && 'signedOff' in value
  );
}
