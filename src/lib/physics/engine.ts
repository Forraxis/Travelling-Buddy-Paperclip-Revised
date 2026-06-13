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
} from './position-map';
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
const VEHICLE_KERB_COG_FRACTION = 0.45;
const FUEL_COG_FRACTION = 0.45;
const PASSENGER_COG_FRACTION = 0.6;
const CARGO_COG_FRACTION = 0.3;

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
  accessoryLoads: Array<{ weight: number; posXMm: number }>;
} {
  const effectiveTareKg = caravan.tareKg + caravanTareOffset;
  const freshWaterMassKg =
    (freshWaterPercent / 100) * caravan.freshWaterCapacityL * 1.0;
  const greyWaterMassKg =
    (greyWaterPercent / 100) * caravan.greyWaterCapacityL * 1.0;

  const accessoryLoads = caravanAccessories.map((acc) => ({
    weight: resolvedAccessoryWeight(acc),
    posXMm:
      acc.cogXMm != null
        ? acc.cogXMm
        : resolveCaravanPositionMm(acc.mountingLocation, caravan),
  }));

  const accessoryMassKg = accessoryLoads.reduce((s, a) => s + a.weight, 0);
  const totalWeightKg =
    effectiveTareKg + freshWaterMassKg + greyWaterMassKg + accessoryMassKg;

  const axleX = caravan.couplingToAxleMm;
  const tareCogX = axleX * CARAVAN_TARE_COG_FRACTION;
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
  };
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
): { frontAxleKg: number; rearAxleKg: number } {
  const wb = vehicle.wheelbaseMm;
  const rearOverhang = vehicle.rearOverhangMm ?? 400;

  let momentSum =
    effectiveKerbKg * (wb * VEHICLE_KERB_COG_FRACTION) +
    fuelMassKg * (wb * FUEL_COG_FRACTION) +
    passengerMassKg * (wb * PASSENGER_COG_FRACTION) +
    cargoKg * (wb * CARGO_COG_FRACTION) +
    towBallDownloadKg * -rearOverhang;

  for (const acc of vehicleAccessories) {
    const weight = resolvedAccessoryWeight(acc);
    const posX =
      acc.cogXMm != null
        ? acc.cogXMm
        : resolveVehiclePositionMm(acc.mountingLocation, vehicle);
    momentSum += weight * posX;
  }

  const frontAxleKg = momentSum / wb;
  const rearAxleKg = totalVehicleWeightKg - frontAxleKg;

  return { frontAxleKg, rearAxleKg };
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
      caravan.tareKg -
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
    };
  }

  // --- Vehicle ---
  const effectiveKerbKg =
    vehicle.kerbWeightKg + (calibration.vehicleKerbKg ?? 0);
  const fuelDensity = FUEL_DENSITY[vehicle.fuelType] ?? 0.73;
  const fuelMassKg =
    (input.fuelPercent / 100) * vehicle.fuelTankCapacityL * fuelDensity;
  const passengerMassKg = passengers * PASSENGER_KG;
  const vehicleAccessoryMassKg = vehicleAccessories.reduce(
    (s, a) => s + resolvedAccessoryWeight(a),
    0,
  );
  const totalVehicleWeightKg =
    effectiveKerbKg +
    fuelMassKg +
    passengerMassKg +
    cargoKg +
    vehicleAccessoryMassKg +
    towBallDownloadKg;

  const { frontAxleKg, rearAxleKg } = computeVehicleAxles(
    vehicle,
    vehicleAccessories,
    effectiveKerbKg,
    fuelMassKg,
    passengerMassKg,
    cargoKg,
    towBallDownloadKg,
    totalVehicleWeightKg,
  );

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
