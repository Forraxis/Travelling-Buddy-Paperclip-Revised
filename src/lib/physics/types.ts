// Physics engine input/output contracts.
// This module has no imports from React, Next.js, Prisma, or any I/O library.

export type FuelType = 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC';

export type AxleConfiguration =
  | 'SINGLE_AXLE'
  | 'DUAL_AXLE_CLOSE_COUPLED'
  | 'DUAL_AXLE_SPREAD'
  | 'TRIPLE_AXLE';

export type MountingLocation =
  | 'CHASSIS_FRONT'
  | 'CHASSIS_MID'
  | 'CHASSIS_REAR'
  | 'BULL_BAR'
  | 'ROOF_RACK'
  | 'ROOF_RAILS'
  | 'TRAY_FLOOR'
  | 'TRAY_SIDE_LEFT'
  | 'TRAY_SIDE_RIGHT'
  | 'TRAY_HEADBOARD'
  | 'TRAY_TAILGATE'
  | 'CANOPY_EXTERIOR'
  | 'CANOPY_INTERIOR'
  | 'CANOPY_ROOF'
  | 'TUB_INTERIOR'
  | 'TUB_EXTERIOR'
  | 'BONNET'
  | 'REAR_BAR'
  | 'TOW_HITCH'
  | 'WHEEL_ARCH_LEFT'
  | 'WHEEL_ARCH_RIGHT'
  | 'UNDERBODY_FRONT'
  | 'UNDERBODY_MID'
  | 'UNDERBODY_REAR'
  | 'A_PILLAR_LEFT'
  | 'A_PILLAR_RIGHT'
  | 'WINDSCREEN'
  | 'CABIN_INTERIOR'
  | 'CABIN_ROOF'
  | 'CABIN_DASH'
  | 'DOOR_LEFT'
  | 'DOOR_RIGHT'
  | 'SNORKEL'
  | 'FENDER_LEFT'
  | 'FENDER_RIGHT'
  | 'CARAVAN_DRAWBAR'
  | 'CARAVAN_A_FRAME'
  | 'CARAVAN_CHASSIS_FRONT'
  | 'CARAVAN_CHASSIS_MID'
  | 'CARAVAN_CHASSIS_REAR'
  | 'CARAVAN_UNDERBODY'
  | 'CARAVAN_ROOF'
  | 'CARAVAN_WALL_LEFT'
  | 'CARAVAN_WALL_RIGHT'
  | 'CARAVAN_WALL_FRONT'
  | 'CARAVAN_WALL_REAR'
  | 'CARAVAN_BUMPER_BAR'
  | 'CARAVAN_BOOT'
  | 'CARAVAN_TUNNEL_BOOT'
  | 'CARAVAN_TOOLBAR_EXTERNAL'
  | 'CARAVAN_TOOLBAR_INTERNAL';

export type RegulationSetCode = 'AU_ADR';

export type MetricStatus = 'ok' | 'warn' | 'fail';
export type OverallStatus = 'pass' | 'warn' | 'fail';
export type RecommendationSeverity = 'info' | 'warn' | 'critical';

export interface VehicleInput {
  gvmKg: number;
  gcmKg: number;
  kerbWeightKg: number;
  maxTowingCapacityKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  maxTowBallDownloadKg: number;
  wheelbaseMm: number;
  frontOverhangMm?: number | null;
  rearOverhangMm?: number | null;
  fuelTankCapacityL: number;
  fuelType: FuelType;
}

export interface CaravanInput {
  atmKg: number;
  gtmKg: number;
  tareKg: number;
  tbmKg: number;
  axleConfiguration: AxleConfiguration;
  couplingToAxleMm: number;
  axleSpacingMm?: number | null;
  freshWaterCapacityL: number;
  greyWaterCapacityL: number;
}

export interface AccessoryLoad {
  installedWeightKg: number;
  mountingLocation: MountingLocation;
  cogXMm?: number | null;
  fillPercent: number;
  quantity: number;
  tankCapacityL?: number | null;
  tankContentsKgPerL?: number | null;
}

export interface CalibrationOverrides {
  vehicleKerbKg?: number;
  caravanTareKg?: number;
}

export interface PhysicsInput {
  vehicle: VehicleInput;
  caravan?: CaravanInput;
  vehicleAccessories: AccessoryLoad[];
  caravanAccessories?: AccessoryLoad[];
  passengers: number;
  /** Average weight per passenger (kg). Defaults to 80 when omitted. */
  passengerAvgWeightKg?: number;
  cargoKg: number;
  fuelPercent: number;
  freshWaterPercent: number;
  greyWaterPercent: number;
  calibrationOverrides?: CalibrationOverrides;
  regulationSetCode: RegulationSetCode;
}

export interface RecommendationAction {
  label: string;
  type: 'affiliate_search' | 'internal_link' | 'advice';
  payload?: string;
}

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  metric: string;
  title: string;
  body: string;
  actions?: RecommendationAction[];
}

export interface VehicleResult {
  totalWeightKg: number;
  effectiveKerbKg: number;
  fuelMassKg: number;
  passengerMassKg: number;
  accessoryMassKg: number;
  gvmLimitKg: number;
  gvmStatus: MetricStatus;
  frontAxleKg: number;
  frontAxleLimitKg: number;
  frontAxleStatus: MetricStatus;
  rearAxleKg: number;
  rearAxleLimitKg: number;
  rearAxleStatus: MetricStatus;
  gcmKg?: number;
  gcmLimitKg?: number;
  gcmStatus?: MetricStatus;
  towBallDownloadKg?: number;
  towBallDownloadLimitKg?: number;
  towBallDownloadStatus?: MetricStatus;
  towBallPctOfAtm?: number;
  towBallPctStatus?: MetricStatus;
}

export interface CaravanAxleResult {
  /** 0-based, ordered front (nearest coupling) → rear. */
  index: number;
  loadKg: number;
  limitKg: number;
  status: MetricStatus;
}

export interface CaravanResult {
  totalWeightKg: number;
  effectiveTareKg: number;
  freshWaterMassKg: number;
  greyWaterMassKg: number;
  accessoryMassKg: number;
  towBallMassKg: number;
  atmLimitKg: number;
  atmStatus: MetricStatus;
  gtmKg: number;
  gtmLimitKg: number;
  gtmStatus: MetricStatus;
  /**
   * Per-physical-axle load breakdown (1 entry for single, 2 for dual, 3 for
   * triple). Even split for single/close-coupled/triple (load-sharing
   * suspension equalises by design); CoG-based lever split for spread tandems
   * where load sharing is weaker — this is what surfaces a single overloaded
   * axle while total GTM is still within limit.
   */
  axles: CaravanAxleResult[];
  payloadRemainingKg: number;
  payloadStatus: MetricStatus;
}

export interface PhysicsResult {
  vehicle: VehicleResult;
  caravan?: CaravanResult;
  overallStatus: OverallStatus;
  recommendations: Recommendation[];
  advisories: string[];
}
