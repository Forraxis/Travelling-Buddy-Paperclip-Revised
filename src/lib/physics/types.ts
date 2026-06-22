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

/**
 * Keys for the compliance limits that drive the verdict. Used only by the
 * advisory "verdict honesty" layer (see {@link VehicleInput.estimatedLimits}) —
 * NOT by the pass/fail math.
 */
export type ComplianceLimitKey =
  | 'gvm'
  | 'gcm'
  | 'frontAxle'
  | 'rearAxle'
  | 'towBall'
  | 'towing';

/**
 * ADVISORY (verdict honesty / provenance): per-compliance-limit source metadata,
 * carried alongside {@link VehicleInput.estimatedLimits} so the UI can render a
 * confidence badge + "help us verify" CTA next to each metric. Purely additive
 * and never read by the pass/fail math. `asOf` is an ISO date string (the
 * "current as of [date]" stamp). Mirrors a `VariantSpecProvenance` row narrowed
 * to a compliance limit.
 */
export interface LimitProvenance {
  status: 'CONFIRMED' | 'ESTIMATE' | 'DISPUTED';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceUrl?: string | null;
  asOf?: string;
}

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
  /** Track width (centre-to-centre of the tyres), mm. Defaults if omitted. */
  trackWidthMm?: number | null;
  fuelTankCapacityL: number;
  fuelType: FuelType;
  /**
   * ADVISORY (verdict honesty): compliance limits whose source is unverified
   * (e.g. a COMMUNITY variant or AI-estimated spec). The verdict math is
   * unchanged — this only lets the UI show "estimated — confirm your compliance
   * plate" next to an otherwise-confident PASS. Empty/undefined = all verified.
   */
  estimatedLimits?: ComplianceLimitKey[];
  /**
   * ADVISORY (verdict honesty): per-limit source metadata (status / confidence /
   * citation / as-of), keyed by {@link ComplianceLimitKey}. Carried forward for a
   * UI confidence badge + "help us verify" CTA. Optional and never read by the
   * verdict math — absent when no provenance is loaded.
   */
  limitProvenance?: Partial<Record<ComplianceLimitKey, LimitProvenance>>;
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
  /** Track width (tyre centres), mm — feeds the lateral (left/right) split. */
  trackWidthMm?: number | null;
}

export interface AccessoryLoad {
  installedWeightKg: number;
  mountingLocation: MountingLocation;
  cogXMm?: number | null;
  /** Lateral position from the centreline, mm. + = right (kerb side in AU). */
  cogYMm?: number | null;
  /**
   * Vertical CoG height above ground, mm. Defaults from the mounting location.
   * Feeds the advisory stability estimate only — has NO effect on axle loads.
   */
  cogZMm?: number | null;
  fillPercent: number;
  quantity: number;
  tankCapacityL?: number | null;
  tankContentsKgPerL?: number | null;
}

/**
 * Static per-metric weighbridge offsets (kg) added to the raw vehicle output
 * after computation. The "mop-up" half of weighbridge calibration: it carries
 * what a single positioned unaccounted load can't represent (diagonal twist,
 * clamp overflow) and the negative-residual bias correction. See
 * {@link CalibrationStaticOffsets} in `calibration.ts` and CALIBRATION_SIGNOFF.md §5.
 */
export interface CalibrationStaticOffsets {
  gvmKg?: number;
  frontAxleKg?: number;
  rearAxleKg?: number;
  corners?: Partial<Record<CornerKey, number>>;
}

export interface CalibrationOverrides {
  vehicleKerbKg?: number;
  caravanTareKg?: number;
  /**
   * Per-model kerb-CoG wheelbase fraction (P3): overrides the engine's default
   * VEHICLE_KERB_COG_FRACTION when the community regression has a gated,
   * signed-off correction for this variant. See calibration-contribution.ts.
   */
  vehicleKerbCogFraction?: number;
  /** Weighbridge static offsets applied to the vehicle metrics (see above). */
  vehicleStaticOffsets?: CalibrationStaticOffsets;
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

export type CornerKey = 'fl' | 'fr' | 'rl' | 'rr';

/**
 * Lateral (left/right) weight distribution. Same beam statics as the
 * longitudinal split, applied across the track. Each tyre's "share" limit is the
 * axle limit ÷ 2 (single rear wheel) — backed by the OE tyres being rated to
 * carry the axle. ADVISORY: it does not change the legal verdict, because the
 * per-accessory lateral position is often a template default until the user
 * positions it. Assumes OE-equivalent tyres.
 */
export interface VehicleLateral {
  /** Per-corner load, kg. */
  corners: Record<CornerKey, number>;
  /** Per-tyre share limit (axle limit ÷ 2), kg. */
  frontCornerLimitKg: number;
  rearCornerLimitKg: number;
  leftKg: number;
  rightKg: number;
  /** right − left; positive = right-heavy. */
  imbalanceKg: number;
  /** |imbalance| as a % of total — handling indicator. */
  imbalancePct: number;
  /** Balance status from imbalancePct (ok < 5%, warn < 10%, else fail). */
  status: MetricStatus;
  /** The worst corner over its tyre share, or null. */
  overShareCorner: CornerKey | null;
  trackWidthMm: number;
}

/**
 * Caravan lateral (left/right) distribution — the van version of
 * {@link VehicleLateral}. Splits the GTM (axle-borne weight; the tow ball is
 * laterally central) left/right by the load's lateral CoG. Per-tyre share limit
 * = GTM limit ÷ wheel count. ADVISORY (same caveats as the vehicle side):
 * off-centre gear shifts it, lateral position is a default until positioned.
 */
export interface CaravanLateral {
  leftKg: number;
  rightKg: number;
  /** right − left; positive = right-heavy. */
  imbalanceKg: number;
  imbalancePct: number;
  status: MetricStatus;
  /** Per-tyre share limit (GTM limit ÷ wheel count), kg. */
  perTyreShareLimitKg: number;
  /** Per-wheel load on the heavier side (the one that could exceed share). */
  heavierSidePerTyreKg: number;
  overShareSide: 'left' | 'right' | null;
  trackWidthMm: number;
  axleCount: number;
}

/**
 * Vertical CoG height + static stability — ADVISORY and PROVISIONAL pending the
 * Rule-11 sign-off (STABILITY_SIGNOFF.md). Height has no effect on axle loads;
 * it drives rollover propensity via the Static Stability Factor (SSF). Never
 * contributes to the overall pass/fail verdict until signed off.
 */
export interface VehicleStability {
  /** Combined CoG height above ground, mm. */
  cogHeightMm: number;
  trackWidthMm: number;
  /** Static Stability Factor = (track / 2) / CoG height. Higher = more stable. */
  ssf: number;
  /** Advisory status from SSF thresholds (ok ≥ 1.05, warn ≥ 0.95, else fail). */
  status: MetricStatus;
  /** True while the metric awaits physics sign-off (display a caveat). */
  provisional: boolean;
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
  /** Lateral (left/right) distribution — advisory. */
  lateral?: VehicleLateral;
  /** Vertical CoG height + static stability — advisory, provisional. */
  stability?: VehicleStability;
  /**
   * ADVISORY (verdict honesty): which compliance limits driving this result come
   * from an unverified source. Pass-through of {@link VehicleInput.estimatedLimits}.
   * The UI flags these so an estimated limit never reads as a confident PASS.
   */
  estimatedLimits?: ComplianceLimitKey[];
  /**
   * ADVISORY (verdict honesty): per-limit source metadata. Pass-through of
   * {@link VehicleInput.limitProvenance}. Lets the UI render a confidence badge +
   * "help us verify" CTA per metric. Does not affect any status above.
   */
  limitProvenance?: Partial<Record<ComplianceLimitKey, LimitProvenance>>;
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
  /** Lateral (left/right) distribution — advisory. */
  lateral?: CaravanLateral;
}

export interface PhysicsResult {
  vehicle: VehicleResult;
  caravan?: CaravanResult;
  overallStatus: OverallStatus;
  recommendations: Recommendation[];
  advisories: string[];
}
