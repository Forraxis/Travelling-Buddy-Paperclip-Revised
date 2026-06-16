import type {
  PhysicsInput,
  PhysicsResult,
  VehicleResult,
  CaravanResult,
  AccessoryLoad,
  VehicleInput,
  CaravanInput,
  OverallStatus,
  MetricStatus,
} from './types';
import {
  resolveVehiclePositionMm,
  resolveCaravanPositionMm,
  resolveVehicleLateralMm,
  resolveCaravanLateralMm,
  resolveVehicleHeightMm,
  DEFAULT_TRACK_WIDTH_MM,
  DEFAULT_CARAVAN_TRACK_WIDTH_MM,
} from './position-map';
import type {
  VehicleLateral,
  CaravanLateral,
  CornerKey,
  VehicleStability,
} from './types';
import { getRegulations, weightStatus, tbmPctStatus } from './regulations';
import { generateRecommendations } from './recommendations';

const FUEL_DENSITY: Record<string, number> = {
  DIESEL: 0.84,
  PETROL: 0.73,
  HYBRID: 0.73,
  ELECTRIC: 0,
};

const PASSENGER_KG = 80;

// Vehicle CoG estimates — fractions of wheelbase from rear axle.
// Exported as the single source of truth: the P3 calibration-contribution
// derivation regresses a per-model delta against this baseline (keep in
// lock-step — see calibration-contribution.ts / CALIBRATION_SIGNOFF.md §5).
export const VEHICLE_KERB_COG_FRACTION = 0.45;
const FUEL_COG_FRACTION = 0.45;
const PASSENGER_COG_FRACTION = 0.6;
const CARGO_COG_FRACTION = 0.3;

// Vertical CoG heights above ground, mm — for the ADVISORY static-stability
// estimate only (no effect on axle loads). PROVISIONAL: typical 4WD/ute values
// pending the Rule-11 sign-off in STABILITY_SIGNOFF.md.
const KERB_COG_HEIGHT_MM = 700; // base vehicle CoG height
const FUEL_COG_HEIGHT_MM = 350; // tank below the floor
const PASSENGER_COG_HEIGHT_MM = 750; // seated occupant CoG
const CARGO_COG_HEIGHT_MM = 700; // loose cargo in tub/boot
const TOW_BALL_COG_HEIGHT_MM = 450; // download acts at hitch height
// SSF (= halfTrack / cogHeight) advisory bands.
const SSF_OK = 1.05;
const SSF_WARN = 0.95;

// Caravan CoG estimates — fractions of couplingToAxleMm from coupling.
// 0.86 produces bare-van TBM within ~4% of typical manufacturer figures.
const CARAVAN_TARE_COG_FRACTION = 0.86;
const FRESH_WATER_COG_FRACTION = 0.7;
const GREY_WATER_COG_FRACTION = 1.1;

function resolvedAccessoryWeight(acc: AccessoryLoad): number {
  if (acc.tankCapacityL != null && acc.tankContentsKgPerL != null) {
    return (
      acc.tankCapacityL *
      acc.tankContentsKgPerL *
      (acc.fillPercent / 100) *
      acc.quantity
    );
  }
  return acc.installedWeightKg * acc.quantity;
}

function computeCaravan(
  caravan: CaravanInput,
  caravanAccessories: AccessoryLoad[],
  freshWaterPercent: number,
  greyWaterPercent: number,
  caravanTareOffset: number,
): {
  totalWeightKg: number;
  effectiveTareKg: number;
  freshWaterMassKg: number;
  greyWaterMassKg: number;
  accessoryMassKg: number;
  towBallMassKg: number;
  gtmKg: number;
  loadCogFromCouplingMm: number;
  accessoryLoads: Array<{ weight: number; posXMm: number; posYMm: number }>;
  lateral: CaravanLateral;
} {
  const effectiveTareKg = caravan.tareKg + caravanTareOffset;
  const freshWaterMassKg =
    (freshWaterPercent / 100) * caravan.freshWaterCapacityL * 1.0;
  const greyWaterMassKg =
    (greyWaterPercent / 100) * caravan.greyWaterCapacityL * 1.0;

  const track = caravan.trackWidthMm ?? DEFAULT_CARAVAN_TRACK_WIDTH_MM;
  const accessoryLoads = caravanAccessories.map((acc) => ({
    weight: resolvedAccessoryWeight(acc),
    posXMm:
      acc.cogXMm != null
        ? acc.cogXMm
        : resolveCaravanPositionMm(acc.mountingLocation, caravan),
    posYMm:
      acc.cogYMm != null
        ? acc.cogYMm
        : resolveCaravanLateralMm(acc.mountingLocation, track),
  }));

  const accessoryMassKg = accessoryLoads.reduce((s, a) => s + a.weight, 0);
  const totalWeightKg =
    effectiveTareKg + freshWaterMassKg + greyWaterMassKg + accessoryMassKg;

  const axleX = caravan.couplingToAxleMm;
  // Anchor the tare centre-of-gravity to the manufacturer-published tow ball
  // mass rather than a fixed fraction. Bare-van TBM = tare × (axleX − tareCogX)
  // / axleX, so tareCogX = axleX × (1 − TBM/tare) reproduces the published
  // figure exactly, per van. A fixed fraction computed a flat 14% of tare for
  // every van, which was ~15% off published on average across the catalogue
  // (over-reading dual-axle vans, under-reading single-axle). Falls back to the
  // generic fraction when TBM/tare data is missing or implausible.
  const tareFraction =
    caravan.tbmKg > 0 && caravan.tareKg > 0
      ? Math.min(0.95, Math.max(0.6, 1 - caravan.tbmKg / caravan.tareKg))
      : CARAVAN_TARE_COG_FRACTION;
  const tareCogX = axleX * tareFraction;
  const freshCogX = axleX * FRESH_WATER_COG_FRACTION;
  const greyCogX = axleX * GREY_WATER_COG_FRACTION;

  // TBM = sum of (weight × (axleX − posX)) / axleX
  // Items forward of axle (posX < axleX) produce positive TBM contribution.
  // Items rearward of axle (posX > axleX) reduce TBM.
  let momentSum =
    effectiveTareKg * (axleX - tareCogX) +
    freshWaterMassKg * (axleX - freshCogX) +
    greyWaterMassKg * (axleX - greyCogX);

  for (const { weight, posXMm } of accessoryLoads) {
    momentSum += weight * (axleX - posXMm);
  }

  const towBallMassKg = momentSum / axleX;
  const gtmKg = totalWeightKg - towBallMassKg;

  // Longitudinal CoG of the total caravan load, measured from the coupling
  // (+rearward). Used to split load across spread tandem axles.
  let loadMomentFromCoupling =
    effectiveTareKg * tareCogX +
    freshWaterMassKg * freshCogX +
    greyWaterMassKg * greyCogX;
  for (const { weight, posXMm } of accessoryLoads) {
    loadMomentFromCoupling += weight * posXMm;
  }
  const loadCogFromCouplingMm =
    totalWeightKg > 0 ? loadMomentFromCoupling / totalWeightKg : axleX;

  // Lateral (left/right) split. Base loads (tare, water) are central (y = 0);
  // only off-centre accessories tilt the balance. We split the GTM — the
  // axle-borne weight — because the tow ball carries TBM and is laterally
  // central. Per-load lateral fractions give the left/right *ratio*, scaled to
  // GTM so the wheels carry the right total.
  let lAcc = 0;
  let rAcc = 0;
  const addLat = (w: number, y: number) => {
    const rf = Math.min(1, Math.max(0, (track / 2 + y) / track));
    rAcc += w * rf;
    lAcc += w * (1 - rf);
  };
  addLat(effectiveTareKg, 0);
  addLat(freshWaterMassKg, 0);
  addLat(greyWaterMassKg, 0);
  for (const { weight, posYMm } of accessoryLoads) addLat(weight, posYMm);

  const latSum = lAcc + rAcc;
  const leftKg = latSum > 0 ? gtmKg * (lAcc / latSum) : gtmKg / 2;
  const rightKg = gtmKg - leftKg;
  const imbalanceKg = rightKg - leftKg;
  const imbalancePct = gtmKg > 0 ? (Math.abs(imbalanceKg) / gtmKg) * 100 : 0;
  const balanceStatus: MetricStatus =
    imbalancePct < 5 ? 'ok' : imbalancePct < 10 ? 'warn' : 'fail';
  const axleCount = axleCountOf(caravan.axleConfiguration);
  const perTyreShareLimitKg = gtmLimitOf(caravan) / (axleCount * 2);
  const heavierSidePerTyreKg = Math.max(leftKg, rightKg) / axleCount;
  const overShareSide: 'left' | 'right' | null =
    heavierSidePerTyreKg > perTyreShareLimitKg
      ? rightKg >= leftKg
        ? 'right'
        : 'left'
      : null;
  const lateral: CaravanLateral = {
    leftKg,
    rightKg,
    imbalanceKg,
    imbalancePct,
    status: balanceStatus,
    perTyreShareLimitKg,
    heavierSidePerTyreKg,
    overShareSide,
    trackWidthMm: track,
    axleCount,
  };

  return {
    totalWeightKg,
    effectiveTareKg,
    freshWaterMassKg,
    greyWaterMassKg,
    accessoryMassKg,
    towBallMassKg,
    gtmKg,
    loadCogFromCouplingMm,
    accessoryLoads,
    lateral,
  };
}

function axleCountOf(config: CaravanInput['axleConfiguration']): number {
  if (config === 'TRIPLE_AXLE') return 3;
  if (config.startsWith('DUAL')) return 2;
  return 1;
}

// Per-tyre share uses the GTM rating as the axle-group limit (the catalogue has
// no separate per-axle/tyre rating yet — see PHYSICS_NOTES.md).
function gtmLimitOf(caravan: CaravanInput): number {
  return caravan.gtmKg;
}

// Split the caravan's GTM across its physical axles.
//
// Single axle carries the full GTM. Close-coupled tandems and triples use
// load-sharing suspension (rocker/equaliser) that balances static load by
// design → even split. Spread tandems share load more weakly, so we split by
// the lever rule from the load CoG — this is what lets one axle read over its
// share while total GTM is still legal. Per-axle limit is GTM_limit / n
// (the catalogue has no separate per-axle rating yet — see PHYSICS_NOTES.md).
function computeCaravanAxles(
  axleConfiguration: CaravanInput['axleConfiguration'],
  gtmKg: number,
  gtmLimitKg: number,
  couplingToAxleMm: number,
  axleSpacingMm: number | null | undefined,
  loadCogFromCouplingMm: number,
): Array<{
  index: number;
  loadKg: number;
  limitKg: number;
  status: MetricStatus;
}> {
  const make = (loadKg: number, limitKg: number, index: number) => ({
    index,
    loadKg,
    limitKg,
    status: weightStatus(loadKg, limitKg),
  });

  if (axleConfiguration === 'SINGLE_AXLE') {
    return [make(gtmKg, gtmLimitKg, 0)];
  }

  if (axleConfiguration === 'DUAL_AXLE_SPREAD') {
    const s = axleSpacingMm && axleSpacingMm > 0 ? axleSpacingMm : 1000;
    const frontX = couplingToAxleMm - s / 2;
    const limitPer = gtmLimitKg / 2;
    // Reaction on each axle from GTM acting at the load CoG (lever rule).
    let rear = (gtmKg * (loadCogFromCouplingMm - frontX)) / s;
    rear = Math.max(0, Math.min(gtmKg, rear));
    const front = gtmKg - rear;
    return [make(front, limitPer, 0), make(rear, limitPer, 1)];
  }

  // Even split — close-coupled tandem / triple (load-sharing suspension).
  const n = axleConfiguration === 'TRIPLE_AXLE' ? 3 : 2;
  const per = gtmKg / n;
  const limitPer = gtmLimitKg / n;
  return Array.from({ length: n }, (_, i) => make(per, limitPer, i));
}

function computeVehicleAxles(
  vehicle: VehicleInput,
  vehicleAccessories: AccessoryLoad[],
  effectiveKerbKg: number,
  fuelMassKg: number,
  passengerMassKg: number,
  cargoKg: number,
  towBallDownloadKg: number,
  totalVehicleWeightKg: number,
  kerbCogFraction: number = VEHICLE_KERB_COG_FRACTION,
): {
  frontAxleKg: number;
  rearAxleKg: number;
  lateral: VehicleLateral;
  stability: VehicleStability;
} {
  const wb = vehicle.wheelbaseMm;
  const rearOverhang = vehicle.rearOverhangMm ?? 400;
  const track = vehicle.trackWidthMm ?? DEFAULT_TRACK_WIDTH_MM;

  // Every load as { weight, x (from rear axle, +forward), y (lateral, +right),
  // z (height above ground) }. Base loads sit on the centreline (y = 0) at
  // assumed heights; accessories carry explicit cogY/cogZ, else mounting defaults.
  const loads: Array<{ w: number; x: number; y: number; z: number }> = [
    {
      w: effectiveKerbKg,
      x: wb * kerbCogFraction,
      y: 0,
      z: KERB_COG_HEIGHT_MM,
    },
    { w: fuelMassKg, x: wb * FUEL_COG_FRACTION, y: 0, z: FUEL_COG_HEIGHT_MM },
    {
      w: passengerMassKg,
      x: wb * PASSENGER_COG_FRACTION,
      y: 0,
      z: PASSENGER_COG_HEIGHT_MM,
    },
    { w: cargoKg, x: wb * CARGO_COG_FRACTION, y: 0, z: CARGO_COG_HEIGHT_MM },
    { w: towBallDownloadKg, x: -rearOverhang, y: 0, z: TOW_BALL_COG_HEIGHT_MM },
  ];
  for (const acc of vehicleAccessories) {
    const weight = resolvedAccessoryWeight(acc);
    const x =
      acc.cogXMm != null
        ? acc.cogXMm
        : resolveVehiclePositionMm(acc.mountingLocation, vehicle);
    const y =
      acc.cogYMm != null
        ? acc.cogYMm
        : resolveVehicleLateralMm(acc.mountingLocation, vehicle);
    const z =
      acc.cogZMm != null
        ? acc.cogZMm
        : resolveVehicleHeightMm(acc.mountingLocation);
    loads.push({ w: weight, x, y, z });
  }

  // Longitudinal front/rear split (existing) + lateral left/right split (new),
  // accumulated into 4 corners. Each load's front share = w·x/wheelbase; its
  // right share = (track/2 + y)/track. Height moment (Σ w·z) feeds the advisory
  // combined CoG height — it does NOT influence the axle split.
  let momentSum = 0;
  let heightMomentSum = 0;
  let fl = 0;
  let fr = 0;
  let rl = 0;
  let rr = 0;
  for (const { w, x, y, z } of loads) {
    momentSum += w * x;
    heightMomentSum += w * z;
    const frontContrib = (w * x) / wb;
    const rearContrib = w - frontContrib;
    const rightFrac = Math.min(1, Math.max(0, (track / 2 + y) / track));
    const leftFrac = 1 - rightFrac;
    fl += frontContrib * leftFrac;
    fr += frontContrib * rightFrac;
    rl += rearContrib * leftFrac;
    rr += rearContrib * rightFrac;
  }

  const frontAxleKg = momentSum / wb;
  const rearAxleKg = totalVehicleWeightKg - frontAxleKg;

  const leftKg = fl + rl;
  const rightKg = fr + rr;
  const imbalanceKg = rightKg - leftKg;
  const imbalancePct =
    totalVehicleWeightKg > 0
      ? (Math.abs(imbalanceKg) / totalVehicleWeightKg) * 100
      : 0;
  const balanceStatus: MetricStatus =
    imbalancePct < 5 ? 'ok' : imbalancePct < 10 ? 'warn' : 'fail';

  const frontCornerLimitKg = vehicle.frontAxleLimitKg / 2;
  const rearCornerLimitKg = vehicle.rearAxleLimitKg / 2;
  const cornerRatios: Array<{ k: CornerKey; ratio: number }> = [
    { k: 'fl', ratio: fl / frontCornerLimitKg },
    { k: 'fr', ratio: fr / frontCornerLimitKg },
    { k: 'rl', ratio: rl / rearCornerLimitKg },
    { k: 'rr', ratio: rr / rearCornerLimitKg },
  ];
  const overs = cornerRatios
    .filter((o) => o.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio);

  const lateral: VehicleLateral = {
    corners: { fl, fr, rl, rr },
    frontCornerLimitKg,
    rearCornerLimitKg,
    leftKg,
    rightKg,
    imbalanceKg,
    imbalancePct,
    status: balanceStatus,
    overShareCorner: overs.length ? overs[0].k : null,
    trackWidthMm: track,
  };

  // ── Vertical CoG height + static stability (ADVISORY / PROVISIONAL) ──────────
  // Combined CoG height = Σ(w·z) / Σw; SSF = (track/2) / CoG height. Higher SSF =
  // more resistant to rollover. Mass-weighted, so a heavy roof load hurts most.
  const cogHeightMm =
    totalVehicleWeightKg > 0 ? heightMomentSum / totalVehicleWeightKg : 0;
  const ssf = cogHeightMm > 0 ? track / 2 / cogHeightMm : 0;
  const stabilityStatus: MetricStatus =
    ssf >= SSF_OK ? 'ok' : ssf >= SSF_WARN ? 'warn' : 'fail';
  const stability: VehicleStability = {
    cogHeightMm,
    trackWidthMm: track,
    ssf,
    status: stabilityStatus,
    provisional: true,
  };

  return { frontAxleKg, rearAxleKg, lateral, stability };
}

// Apply weighbridge static offsets (the "mop-up" half of calibration) to the
// raw vehicle axle/total/corner figures and recompute the dependent lateral
// aggregates. The positioned "unaccounted load" is added upstream as a normal
// load; this only carries the part a point load can't represent. The offsets
// are internally consistent (corners sum to axles sum to GVM), so total stays
// equal to front+rear. See CALIBRATION_SIGNOFF.md §5.
function applyVehicleStaticOffsets(
  base: {
    frontAxleKg: number;
    rearAxleKg: number;
    totalKg: number;
    lateral: VehicleLateral;
  },
  offsets: NonNullable<
    PhysicsInput['calibrationOverrides']
  >['vehicleStaticOffsets'],
): {
  frontAxleKg: number;
  rearAxleKg: number;
  totalKg: number;
  lateral: VehicleLateral;
} {
  if (!offsets) return base;
  const frontAxleKg = base.frontAxleKg + (offsets.frontAxleKg ?? 0);
  const rearAxleKg = base.rearAxleKg + (offsets.rearAxleKg ?? 0);
  const totalKg = base.totalKg + (offsets.gvmKg ?? 0);

  let lateral = base.lateral;
  if (offsets.corners) {
    const c = base.lateral.corners;
    const corners: Record<CornerKey, number> = {
      fl: c.fl + (offsets.corners.fl ?? 0),
      fr: c.fr + (offsets.corners.fr ?? 0),
      rl: c.rl + (offsets.corners.rl ?? 0),
      rr: c.rr + (offsets.corners.rr ?? 0),
    };
    const leftKg = corners.fl + corners.rl;
    const rightKg = corners.fr + corners.rr;
    const imbalanceKg = rightKg - leftKg;
    const imbalancePct =
      totalKg > 0 ? (Math.abs(imbalanceKg) / totalKg) * 100 : 0;
    const status: MetricStatus =
      imbalancePct < 5 ? 'ok' : imbalancePct < 10 ? 'warn' : 'fail';
    const ratios: Array<{ k: CornerKey; ratio: number }> = [
      { k: 'fl', ratio: corners.fl / base.lateral.frontCornerLimitKg },
      { k: 'fr', ratio: corners.fr / base.lateral.frontCornerLimitKg },
      { k: 'rl', ratio: corners.rl / base.lateral.rearCornerLimitKg },
      { k: 'rr', ratio: corners.rr / base.lateral.rearCornerLimitKg },
    ];
    const overs = ratios
      .filter((o) => o.ratio > 1)
      .sort((a, b) => b.ratio - a.ratio);
    lateral = {
      ...base.lateral,
      corners,
      leftKg,
      rightKg,
      imbalanceKg,
      imbalancePct,
      status,
      overShareCorner: overs.length ? overs[0].k : null,
    };
  }
  return { frontAxleKg, rearAxleKg, totalKg, lateral };
}

function worstStatus(...statuses: MetricStatus[]): OverallStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

export function calculate(input: PhysicsInput): PhysicsResult {
  const { vehicle, caravan, vehicleAccessories, passengers, cargoKg } = input;
  const caravanAccessories = input.caravanAccessories ?? [];
  const calibration = input.calibrationOverrides ?? {};
  const freshWaterPercent = input.freshWaterPercent;
  const greyWaterPercent = input.greyWaterPercent;

  const regulations = getRegulations(input);

  // --- Caravan (computed first because towBallDownload feeds vehicle) ---
  let caravanResult: CaravanResult | undefined;
  let towBallDownloadKg = 0;

  if (caravan) {
    const cv = computeCaravan(
      caravan,
      caravanAccessories,
      freshWaterPercent,
      greyWaterPercent,
      calibration.caravanTareKg ?? 0,
    );

    towBallDownloadKg = Math.max(0, cv.towBallMassKg);
    const atmStatus = weightStatus(cv.totalWeightKg, caravan.atmKg);
    const gtmStatus = weightStatus(cv.gtmKg, caravan.gtmKg);
    const payloadRemainingKg =
      caravan.atmKg -
      cv.effectiveTareKg -
      cv.accessoryMassKg -
      cv.freshWaterMassKg -
      cv.greyWaterMassKg;
    const payloadStatus: MetricStatus = payloadRemainingKg < 0 ? 'fail' : 'ok';

    const axles = computeCaravanAxles(
      caravan.axleConfiguration,
      cv.gtmKg,
      caravan.gtmKg,
      caravan.couplingToAxleMm,
      caravan.axleSpacingMm,
      cv.loadCogFromCouplingMm,
    );

    caravanResult = {
      totalWeightKg: cv.totalWeightKg,
      effectiveTareKg: cv.effectiveTareKg,
      freshWaterMassKg: cv.freshWaterMassKg,
      greyWaterMassKg: cv.greyWaterMassKg,
      accessoryMassKg: cv.accessoryMassKg,
      towBallMassKg: cv.towBallMassKg,
      atmLimitKg: caravan.atmKg,
      atmStatus,
      gtmKg: cv.gtmKg,
      gtmLimitKg: caravan.gtmKg,
      gtmStatus,
      axles,
      payloadRemainingKg,
      payloadStatus,
      lateral: cv.lateral,
    };
  }

  // --- Vehicle ---
  const effectiveKerbKg =
    vehicle.kerbWeightKg + (calibration.vehicleKerbKg ?? 0);
  const fuelDensity = FUEL_DENSITY[vehicle.fuelType] ?? 0.73;
  const fuelMassKg =
    (input.fuelPercent / 100) * vehicle.fuelTankCapacityL * fuelDensity;
  const passengerMassKg =
    passengers * (input.passengerAvgWeightKg ?? PASSENGER_KG);
  const vehicleAccessoryMassKg = vehicleAccessories.reduce(
    (s, a) => s + resolvedAccessoryWeight(a),
    0,
  );
  let totalVehicleWeightKg =
    effectiveKerbKg +
    fuelMassKg +
    passengerMassKg +
    cargoKg +
    vehicleAccessoryMassKg +
    towBallDownloadKg;

  const rawAxles = computeVehicleAxles(
    vehicle,
    vehicleAccessories,
    effectiveKerbKg,
    fuelMassKg,
    passengerMassKg,
    cargoKg,
    towBallDownloadKg,
    totalVehicleWeightKg,
    calibration.vehicleKerbCogFraction ?? VEHICLE_KERB_COG_FRACTION,
  );

  // Weighbridge static-offset mop-up (the positioned unaccounted load is already
  // among vehicleAccessories). Recomputes the lateral aggregates it touches.
  const adjusted = applyVehicleStaticOffsets(
    {
      frontAxleKg: rawAxles.frontAxleKg,
      rearAxleKg: rawAxles.rearAxleKg,
      totalKg: totalVehicleWeightKg,
      lateral: rawAxles.lateral,
    },
    calibration.vehicleStaticOffsets,
  );
  const frontAxleKg = adjusted.frontAxleKg;
  const rearAxleKg = adjusted.rearAxleKg;
  const lateral = adjusted.lateral;
  totalVehicleWeightKg = adjusted.totalKg;

  const gvmStatus = weightStatus(totalVehicleWeightKg, vehicle.gvmKg);
  const frontAxleStatus = weightStatus(frontAxleKg, vehicle.frontAxleLimitKg);
  const rearAxleStatus = weightStatus(rearAxleKg, vehicle.rearAxleLimitKg);

  let gcmKg: number | undefined;
  let gcmLimitKg: number | undefined;
  let gcmStatus: MetricStatus | undefined;
  let towBallDownloadStatus: MetricStatus | undefined;
  let towBallDownloadLimitKg: number | undefined;
  let towBallPctOfAtm: number | undefined;
  let towBallPctStatus: MetricStatus | undefined;

  if (caravan && caravanResult) {
    gcmKg = totalVehicleWeightKg + caravanResult.totalWeightKg;
    gcmLimitKg = vehicle.gcmKg;
    gcmStatus = weightStatus(gcmKg, gcmLimitKg);

    towBallDownloadLimitKg = regulations.towBallDownloadLimitKg!;
    towBallDownloadStatus = weightStatus(
      towBallDownloadKg,
      towBallDownloadLimitKg,
    );

    towBallPctOfAtm = (caravanResult.towBallMassKg / caravan.atmKg) * 100;
    towBallPctStatus = tbmPctStatus(towBallPctOfAtm);
  }

  const vehicleResult: VehicleResult = {
    totalWeightKg: totalVehicleWeightKg,
    effectiveKerbKg,
    fuelMassKg,
    passengerMassKg,
    accessoryMassKg: vehicleAccessoryMassKg,
    gvmLimitKg: vehicle.gvmKg,
    gvmStatus,
    frontAxleKg,
    frontAxleLimitKg: vehicle.frontAxleLimitKg,
    frontAxleStatus,
    rearAxleKg,
    rearAxleLimitKg: vehicle.rearAxleLimitKg,
    rearAxleStatus,
    gcmKg,
    gcmLimitKg,
    gcmStatus,
    towBallDownloadKg: caravan ? towBallDownloadKg : undefined,
    towBallDownloadLimitKg,
    towBallDownloadStatus,
    towBallPctOfAtm,
    towBallPctStatus,
    lateral,
    // Advisory + provisional — unaffected by weighbridge static offsets, so it
    // comes from the base axle computation. NOT added to the overall verdict.
    stability: rawAxles.stability,
  };

  // Collect all statuses to determine overall
  const allStatuses: MetricStatus[] = [
    gvmStatus,
    frontAxleStatus,
    rearAxleStatus,
  ];
  if (gcmStatus) allStatuses.push(gcmStatus);
  if (towBallDownloadStatus) allStatuses.push(towBallDownloadStatus);
  if (towBallPctStatus) allStatuses.push(towBallPctStatus);
  if (caravanResult) {
    allStatuses.push(
      caravanResult.atmStatus,
      caravanResult.gtmStatus,
      caravanResult.payloadStatus,
    );
    for (const axle of caravanResult.axles) allStatuses.push(axle.status);
  }

  const overallStatus = worstStatus(...allStatuses);

  const result: PhysicsResult = {
    vehicle: vehicleResult,
    caravan: caravanResult,
    overallStatus,
    recommendations: [],
    advisories: [],
  };

  result.recommendations = generateRecommendations(
    input,
    result,
    vehicleAccessories,
  );

  // Roof-load advisory
  const roofLocations = new Set([
    'ROOF_RACK',
    'ROOF_RAILS',
    'CANOPY_ROOF',
    'CABIN_ROOF',
  ]);
  const roofWeightKg = vehicleAccessories
    .filter((a) => roofLocations.has(a.mountingLocation))
    .reduce((s, a) => s + resolvedAccessoryWeight(a), 0);
  if (roofWeightKg > 80) {
    result.advisories.push(
      `${Math.round(roofWeightKg)} kg on roof-level mounts raises the vehicle's centre of gravity. Avoid sharp manoeuvres at speed.`,
    );
  }

  return result;
}
