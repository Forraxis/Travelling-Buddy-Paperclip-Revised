// P3 — the data moat. Turns one user's weighbridge contribution into two
// per-model signals (kerb-mass and kerb-CoG-fraction), and aggregates a pool of
// contributions into a robust per-variant correction the engine can read.
//
// ⚠ Rule-11: the derivation below is PROVISIONAL — the spec lives in
// CALIBRATION_SIGNOFF.md §9, pending Tim's sign-off on the "everyone loads the
// back" confound. The kerb-MASS aggregate is meant to auto-apply once it clears
// the min-N gate; the kerb-CoG-FRACTION aggregate stays display-only / gated
// until signed off. Keep this file and §9 in lock-step.
//
// Design principle — STORE RAW, DERIVE LATER: callers persist the raw inputs
// (C₀ physics input, M₀ measurement, P₀ prediction). Everything here is a pure
// function of those, so the formula can be re-run retroactively as it matures.
//
// No React / Next / Prisma / I/O imports. Pure, fully unit-testable.

import type { PhysicsInput, CalibrationOverrides } from './types';
import type { WeighbridgeMeasurement } from './calibration';
import { calculate, VEHICLE_KERB_COG_FRACTION } from './engine';

/** Minimum bareness-weighted samples before a correction is published. */
export const MIN_SAMPLES = 3;

/** Reject a contribution whose measured total is implausible vs the model. */
const SANE_TOTAL_LO = 0.5;
const SANE_TOTAL_HI = 2.0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Measured total (kg) for the ticket's granularity, or null if unavailable. */
export function measuredTotalKg(m: WeighbridgeMeasurement): number | null {
  if (m.granularity === 'TOTAL') return m.totalKg ?? null;
  if (m.granularity === 'AXLE') {
    return m.frontAxleKg != null && m.rearAxleKg != null
      ? m.frontAxleKg + m.rearAxleKg
      : null;
  }
  if (m.granularity === 'CORNER' && m.corners) {
    const { fl, fr, rl, rr } = m.corners;
    return fl != null && fr != null && rl != null && rr != null
      ? fl + fr + rl + rr
      : null;
  }
  return null; // TOWBALL alone carries no vehicle total
}

/** Measured front/rear axle split (kg), or null when the ticket lacks one. */
function measuredAxles(
  m: WeighbridgeMeasurement,
): { front: number; rear: number } | null {
  if (m.granularity === 'AXLE') {
    return m.frontAxleKg != null && m.rearAxleKg != null
      ? { front: m.frontAxleKg, rear: m.rearAxleKg }
      : null;
  }
  if (m.granularity === 'CORNER' && m.corners) {
    const { fl, fr, rl, rr } = m.corners;
    return fl != null && fr != null && rl != null && rr != null
      ? { front: fl + fr, rear: rl + rr }
      : null;
  }
  return null;
}

export interface DerivedContribution {
  measuredTotalKg: number;
  predictedTotalKg: number;
  /** ΔM = measured − predicted total: the unexplained mass. */
  residualMassKg: number;
  /** kerb / measuredTotal ∈ (0,1]; ~1 = stripped vehicle = pristine base read. */
  barenessWeight: number;
  /** Raw kerb-mass signal (= ΔM); the aggregate interprets it, not this row. */
  kerbMassDeltaKg: number;
  /** Implied kerb-CoG wheelbase-fraction shift; null without an axle split. */
  cogFractionDelta: number | null;
}

/**
 * Derive the two per-contribution signals from a weighed config and its ticket.
 *
 * P₀ is recomputed here from the raw input (never trust a client-sent delta).
 * Returns null when the ticket is unusable or implausibly far from the model
 * (a likely data-entry error — let it drop rather than poison the pool).
 */
export function deriveContribution(
  input: PhysicsInput,
  measurement: WeighbridgeMeasurement,
): DerivedContribution | null {
  const measured = measuredTotalKg(measurement);
  if (measured == null || measured <= 0) return null;

  const p0 = calculate(input).vehicle;
  const predicted = p0.totalWeightKg;
  if (predicted <= 0) return null;

  // Drop implausible tickets (extra digit, wrong vehicle, units mistake).
  const ratio = measured / predicted;
  if (ratio < SANE_TOTAL_LO || ratio > SANE_TOTAL_HI) return null;

  const residualMassKg = measured - predicted;
  const kerb = input.vehicle.kerbWeightKg;
  const wb = input.vehicle.wheelbaseMm;
  const barenessWeight = kerb > 0 ? clamp(kerb / measured, 0, 1) : 0;

  // ── kerb-CoG-fraction signal (longitudinal) ──────────────────────────────
  // Needs an axle split. Front axle load = Σ wᵢ·(xᵢ/wb), so the kerb (at
  // fraction 0.45) contributes kerb·0.45 to the predicted front axle. Subtract
  // it to isolate the other modelled loads' front contribution, then ask: if
  // the unexplained mass ΔM were really part of the base vehicle, where would
  // the base mass (kerb+ΔM) have to sit to reproduce the MEASURED front axle?
  //   measuredFront = (kerb+ΔM)·f + otherFront   ⇒   f = (measuredFront − otherFront)/(kerb+ΔM)
  // That conservative attribution (ΔM folded into base) is the §9 convention.
  let cogFractionDelta: number | null = null;
  const axles = measuredAxles(measurement);
  if (axles && wb > 0 && kerb > 0) {
    const otherFront = p0.frontAxleKg - kerb * VEHICLE_KERB_COG_FRACTION;
    const baseMass = kerb + residualMassKg;
    // Guard a degenerate base mass (measured far under predicted): that's noise,
    // not a CoG read.
    if (baseMass > 0.5 * kerb) {
      const f = (axles.front - otherFront) / baseMass;
      cogFractionDelta = f - VEHICLE_KERB_COG_FRACTION;
    }
  }

  return {
    measuredTotalKg: measured,
    predictedTotalKg: predicted,
    residualMassKg,
    barenessWeight,
    kerbMassDeltaKg: residualMassKg,
    cogFractionDelta,
  };
}

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface WeightedSample {
  value: number;
  weight: number;
}

/**
 * Weighted median: the value where cumulative weight crosses half the total.
 * Robust to the idiosyncratic junk in any single contribution. Averaging would
 * let one fully-loaded outlier drag the estimate; the median resists that.
 */
export function weightedMedian(samples: WeightedSample[]): number | null {
  const valid = samples.filter(
    (s) => Number.isFinite(s.value) && s.weight > 0,
  );
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((acc, s) => acc + s.weight, 0);
  let cum = 0;
  for (const s of sorted) {
    cum += s.weight;
    if (cum >= total / 2) return s.value;
  }
  return sorted[sorted.length - 1].value;
}

export interface CorrectionAggregate {
  /** Bareness-weighted median kerb-mass delta (kg); null until min-N met. */
  kerbMassDeltaKg: number | null;
  kerbMassSampleCount: number;
  /** Bareness-weighted median CoG-fraction delta; null until min-N met. */
  cogFractionDelta: number | null;
  cogSampleCount: number;
}

/**
 * Fold a pool of derived contributions into one per-variant correction.
 * Bareness weighting makes near-kerb weigh-ins dominate (the cleanest base
 * read) and fully-loaded rigs count for little. Each correction publishes only
 * once it has MIN_SAMPLES contributing rows.
 */
export function aggregateCorrection(
  rows: DerivedContribution[],
): CorrectionAggregate {
  const massSamples: WeightedSample[] = rows
    .map((r) => ({ value: r.kerbMassDeltaKg, weight: r.barenessWeight }))
    .filter((s) => s.weight > 0);

  const cogSamples: WeightedSample[] = rows
    .filter((r) => r.cogFractionDelta != null)
    .map((r) => ({ value: r.cogFractionDelta as number, weight: r.barenessWeight }))
    .filter((s) => s.weight > 0);

  return {
    kerbMassDeltaKg:
      massSamples.length >= MIN_SAMPLES ? weightedMedian(massSamples) : null,
    kerbMassSampleCount: massSamples.length,
    cogFractionDelta:
      cogSamples.length >= MIN_SAMPLES ? weightedMedian(cogSamples) : null,
    cogSampleCount: cogSamples.length,
  };
}

// ── Engine surfacing ──────────────────────────────────────────────────────────

/** The published, per-variant correction as the engine cares about it. */
export interface ModelCorrection {
  kerbMassDeltaKg: number | null;
  kerbMassApplied: boolean;
  cogFractionDelta: number | null;
  /** GATED: false until a Rule-11 sign-off blesses the CoG-fraction shift. */
  cogApplied: boolean;
}

/**
 * Fold a published per-variant correction into a base CalibrationOverrides.
 *
 * - kerb-mass applies when `kerbMassApplied`.
 * - kerb-CoG-fraction applies ONLY when `cogApplied` (the gated, signed-off path).
 *
 * Never clobbers a field the caller already set: a user's OWN weighbridge
 * calibration is more authoritative than the crowd estimate, so the caller
 * should pass it as `base` (or skip the merge entirely when the user has weighed).
 */
export function mergeModelCorrection(
  base: CalibrationOverrides | undefined,
  correction: ModelCorrection | null,
): CalibrationOverrides | undefined {
  if (!correction) return base;
  const out: CalibrationOverrides = { ...(base ?? {}) };

  if (
    correction.kerbMassApplied &&
    correction.kerbMassDeltaKg != null &&
    out.vehicleKerbKg == null
  ) {
    out.vehicleKerbKg = correction.kerbMassDeltaKg;
  }
  if (
    correction.cogApplied &&
    correction.cogFractionDelta != null &&
    out.vehicleKerbCogFraction == null
  ) {
    out.vehicleKerbCogFraction =
      VEHICLE_KERB_COG_FRACTION + correction.cogFractionDelta;
  }

  return Object.keys(out).length ? out : base;
}
