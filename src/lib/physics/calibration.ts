// Weighbridge calibration — turn a measured ticket into (a) a positioned
// "unaccounted load" and (b) a small static mop-up offset, per CALIBRATION_SIGNOFF.md.
//
// ⚠ Rule-11: the math here is the spec in CALIBRATION_SIGNOFF.md (§3–§6),
// pending Tim's sign-off. Keep the two in lock-step — change one, change both.
//
// No React / Next / Prisma / I/O imports. Pure, fully unit-testable.

import type { CornerKey } from './types';

/** What the weighbridge ticket reports. Progressive fidelity (§4). */
export type CalibrationGranularity = 'TOTAL' | 'AXLE' | 'CORNER' | 'TOWBALL';

/** The measured ticket (kg). Only the fields for its granularity are required. */
export interface WeighbridgeMeasurement {
  granularity: CalibrationGranularity;
  /** Total / GVM reading. */
  totalKg?: number;
  /** Steer (front) axle. */
  frontAxleKg?: number;
  /** Drive (rear) axle. */
  rearAxleKg?: number;
  /** Per-corner scales: fl, fr, rl, rr. */
  corners?: Partial<Record<CornerKey, number>>;
  /** Ball scale (coupling) — caravan side, deferred to a later P1 slice. */
  towBallKg?: number;
}

/** The model's raw prediction for the weighed config C₀ (no calibration). */
export interface PredictedVehicle {
  totalKg: number;
  frontAxleKg: number;
  rearAxleKg: number;
  corners?: Record<CornerKey, number>;
}

/** Rig geometry needed to solve a load's position. */
export interface VehicleGeometry {
  wheelbaseMm: number;
  trackWidthMm: number;
  /** Front overhang (mm) — bounds how far forward a load can sit. Default 1200. */
  frontOverhangMm?: number | null;
  /** Rear overhang (mm) — bounds how far behind the rear axle. Default 1200. */
  rearOverhangMm?: number | null;
}

/**
 * The residual realised as a real load (§4 / Mode A). Longitudinal X is engine
 * convention: mm from the rear axle, + forward. Lateral Y: mm from centreline,
 * + right. `isBestGuessPosition` = TOTAL-only fit, so the user should drag it.
 */
export interface UnaccountedLoad {
  side: 'vehicle';
  massKg: number;
  cogXMm: number;
  cogYMm: number;
  isBestGuessPosition: boolean;
}

/**
 * Static per-metric offsets (Mode B / §5 mop-up) added to the raw model output.
 * These carry the part a single point load can't represent (the diagonal twist,
 * any clamp overflow) and the negative-residual bias correction. Internally
 * consistent: corner offsets sum to the axle offsets, which sum to the GVM offset.
 */
export interface CalibrationStaticOffsets {
  gvmKg?: number;
  frontAxleKg?: number;
  rearAxleKg?: number;
  corners?: Partial<Record<CornerKey, number>>;
}

export interface CalibrationResult {
  unaccountedLoad: UnaccountedLoad | null;
  staticOffsets: CalibrationStaticOffsets;
  /** Human-readable trace of what each level reproduced — for the entry panel. */
  notes: string[];
}

/**
 * Below this absolute residual mass we don't try to *position* the load — a
 * point load's position is ill-conditioned (x = ΔF·wb/m blows up as m → 0).
 * The whole axle residual spills to a static offset instead (§6.2).
 */
export const MIN_POSITIONED_MASS_KG = 15;

function defaultOverhang(v: number | null | undefined, fallback: number): number {
  return v != null && v > 0 ? v : fallback;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Marginal contribution of a vehicle load to each measured metric, using the
 * exact lever math the engine uses (`computeVehicleAxles`). Keeping this here
 * (rather than running the engine) lets calibration.ts stay pure and lets us
 * compute the "remainder" a positioned load leaves behind (§5 step 3).
 */
function loadContribution(
  massKg: number,
  cogXMm: number,
  cogYMm: number,
  geom: VehicleGeometry,
): { front: number; rear: number; corners: Record<CornerKey, number> } {
  const wb = geom.wheelbaseMm;
  const track = geom.trackWidthMm;
  const front = (massKg * cogXMm) / wb;
  const rear = massKg - front;
  const rightFrac = clamp((track / 2 + cogYMm) / track, 0, 1);
  const leftFrac = 1 - rightFrac;
  return {
    front,
    rear,
    corners: {
      fl: front * leftFrac,
      fr: front * rightFrac,
      rl: rear * leftFrac,
      rr: rear * rightFrac,
    },
  };
}

/**
 * Solve a weighbridge ticket into a positioned unaccounted load plus a static
 * mop-up offset (CALIBRATION_SIGNOFF.md §4–§6). The vehicle side: TOTAL / AXLE
 * / CORNER. Tow-ball (caravan) calibration is a later slice.
 *
 * @param measurement  the measured ticket
 * @param predicted    the raw model prediction P₀ for the weighed config C₀
 * @param geom         rig geometry
 * @param opts.preferStaticOnly  user said "I don't know where the mass is" →
 *   skip the position solve, put the whole residual into static offsets.
 */
export function solveVehicleCalibration(
  measurement: WeighbridgeMeasurement,
  predicted: PredictedVehicle,
  geom: VehicleGeometry,
  opts: { preferStaticOnly?: boolean } = {},
): CalibrationResult {
  const notes: string[] = [];
  const wb = geom.wheelbaseMm;
  const track = geom.trackWidthMm;
  const xMin = -defaultOverhang(geom.rearOverhangMm, 1200);
  const xMax = wb + defaultOverhang(geom.frontOverhangMm, 1200);
  const yBound = track * 0.6;

  // --- Resolve the residual at the ticket's fidelity into total / ΔF / ΔR ---
  let mTotal: number;
  let dFront: number | null = null;
  let dRear: number | null = null;
  let cornerResidual: Record<CornerKey, number> | null = null;

  if (
    measurement.granularity === 'CORNER' &&
    measurement.corners &&
    predicted.corners
  ) {
    const mc = measurement.corners;
    const pc = predicted.corners;
    const k: CornerKey[] = ['fl', 'fr', 'rl', 'rr'];
    cornerResidual = { fl: 0, fr: 0, rl: 0, rr: 0 };
    for (const key of k) {
      cornerResidual[key] = (mc[key] ?? pc[key]) - pc[key];
    }
    dFront = cornerResidual.fl + cornerResidual.fr;
    dRear = cornerResidual.rl + cornerResidual.rr;
    mTotal = dFront + dRear;
  } else if (
    measurement.granularity === 'AXLE' &&
    measurement.frontAxleKg != null &&
    measurement.rearAxleKg != null
  ) {
    dFront = measurement.frontAxleKg - predicted.frontAxleKg;
    dRear = measurement.rearAxleKg - predicted.rearAxleKg;
    mTotal = dFront + dRear;
  } else {
    // TOTAL (or a higher granularity missing its fields).
    const measuredTotal = measurement.totalKg ?? predicted.totalKg;
    mTotal = measuredTotal - predicted.totalKg;
  }

  // --- Degenerate / non-positionable cases → pure static offset (§6) ---
  // Negative residual (model over-reads — a draggable "−kg load" is nonsense),
  // or mass too small to place a well-conditioned position.
  const positionable =
    !opts.preferStaticOnly && mTotal >= MIN_POSITIONED_MASS_KG;

  if (!positionable) {
    if (opts.preferStaticOnly) {
      notes.push('Static offset only (position unknown).');
    } else if (mTotal < 0) {
      notes.push(
        `Model over-reads by ${Math.abs(Math.round(mTotal))} kg — applied as a static bias correction, not a load.`,
      );
    } else {
      notes.push(
        `Residual ${Math.round(mTotal)} kg is below the ${MIN_POSITIONED_MASS_KG} kg positioning threshold — applied as a static offset.`,
      );
    }
    return {
      unaccountedLoad: null,
      staticOffsets: staticFromResidual(mTotal, dFront, dRear, cornerResidual),
      notes,
    };
  }

  // --- Fit the positioned load (§4) ---
  let x: number;
  let isBestGuess = false;
  if (dFront != null) {
    // AXLE / CORNER: x solved so the load reproduces the front/rear split.
    x = clamp((dFront * wb) / mTotal, xMin, xMax);
  } else {
    // TOTAL: no axle info — best-guess at the cargo zone (engine CARGO frac 0.3).
    x = wb * 0.3;
    isBestGuess = true;
  }

  let y = 0;
  if (cornerResidual) {
    const dRightSide = cornerResidual.fr + cornerResidual.rr;
    // rightFrac = (track/2 + y)/track ; m·rightFrac = dRightSide → solve y.
    y = clamp((dRightSide / mTotal - 0.5) * track, -yBound, yBound);
  }

  const load: UnaccountedLoad = {
    side: 'vehicle',
    massKg: mTotal,
    cogXMm: Math.round(x),
    cogYMm: Math.round(y),
    isBestGuessPosition: isBestGuess,
  };

  // --- Remainder the point load can't represent → static mop-up (§5 step 3) ---
  const contrib = loadContribution(mTotal, x, y, geom);
  const offsets: CalibrationStaticOffsets = {};

  if (cornerResidual) {
    const k: CornerKey[] = ['fl', 'fr', 'rl', 'rr'];
    const cornerOff: Partial<Record<CornerKey, number>> = {};
    let twist = 0;
    for (const key of k) {
      const rem = round1(cornerResidual[key] - contrib.corners[key]);
      cornerOff[key] = rem;
      twist += Math.abs(rem);
    }
    offsets.corners = cornerOff;
    offsets.frontAxleKg = round1(
      (dFront ?? 0) - (contrib.front),
    );
    offsets.rearAxleKg = round1((dRear ?? 0) - contrib.rear);
    offsets.gvmKg = round1((offsets.frontAxleKg ?? 0) + (offsets.rearAxleKg ?? 0));
    if (twist > 1) {
      notes.push(
        `Corner ticket: total, front/rear and left/right reproduced by the load; ${Math.round(twist)} kg of diagonal twist held as a static corner offset.`,
      );
    } else {
      notes.push('Corner ticket reproduced by the positioned load.');
    }
  } else if (dFront != null) {
    // AXLE: remainder only where x was clamped (otherwise exact).
    offsets.frontAxleKg = round1(dFront - contrib.front);
    offsets.rearAxleKg = round1((dRear ?? 0) - contrib.rear);
    offsets.gvmKg = round1((offsets.frontAxleKg ?? 0) + (offsets.rearAxleKg ?? 0));
    const clamped = Math.abs((offsets.frontAxleKg ?? 0)) > 1;
    notes.push(
      clamped
        ? 'Axle ticket: load clamped to the rig; remainder held as a static axle offset.'
        : 'Axle ticket reproduced exactly by the positioned load.',
    );
  } else {
    notes.push(
      `Total ${Math.round(mTotal)} kg placed at a best-guess spot — drag it to where the weight actually sits for an accurate axle split.`,
    );
  }

  return { unaccountedLoad: load, staticOffsets: offsets, notes };
}

/** Build a fully-static offset set from a residual (no positioned load). */
function staticFromResidual(
  mTotal: number,
  dFront: number | null,
  dRear: number | null,
  cornerResidual: Record<CornerKey, number> | null,
): CalibrationStaticOffsets {
  if (cornerResidual) {
    return {
      gvmKg: round1(mTotal),
      frontAxleKg: round1((dFront ?? 0)),
      rearAxleKg: round1((dRear ?? 0)),
      corners: {
        fl: round1(cornerResidual.fl),
        fr: round1(cornerResidual.fr),
        rl: round1(cornerResidual.rl),
        rr: round1(cornerResidual.rr),
      },
    };
  }
  if (dFront != null) {
    return {
      gvmKg: round1(mTotal),
      frontAxleKg: round1(dFront),
      rearAxleKg: round1(dRear ?? 0),
    };
  }
  return { gvmKg: round1(mTotal) };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
