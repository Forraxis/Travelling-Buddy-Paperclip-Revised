// Pure geometry model for the side-profile rig schematic.
//
// This module turns raw vehicle/caravan geometry + accessory placements + a
// PhysicsResult into a layout expressed in a single global millimetre axis
// (increasing left-to-right on screen). The vehicle faces right (front at the
// far right); an attached caravan trails to the left, its coupling meeting the
// vehicle's tow hitch. This mirrors how a rig sits in real life and means every
// accessory dot lands where the weight physically is — a rear-of-van toolbar
// sits at the far left, a bull bar at the far right.
//
// It deliberately has no React/DOM dependency so it can be unit-tested and
// reused by the (future) PDF print template. It reuses the same position
// resolvers as the physics engine so the schematic and the numbers never drift.

import type {
  MountingLocation,
  PhysicsResult,
  MetricStatus,
} from '@/lib/physics/types';
import {
  resolveVehiclePositionMm,
  resolveCaravanPositionMm,
} from '@/lib/physics/position-map';

export type VehicleBodyKind = 'ute' | 'wagon' | 'van';
export type CaravanBodyKind = 'caravan' | 'poptop' | 'camper';

export interface SchematicVehicleGeometry {
  wheelbaseMm: number;
  frontOverhangMm?: number | null;
  rearOverhangMm?: number | null;
  bodyType?: string | null;
}

export interface SchematicCaravanGeometry {
  couplingToAxleMm: number;
  axleSpacingMm?: number | null;
  bodyLengthMm?: number | null;
  overallLengthMm?: number | null;
  axleConfiguration: string;
  bodyType?: string | null;
}

export interface SchematicAccessory {
  id: string;
  weightKg: number;
  mountingLocation: MountingLocation;
  label?: string | null;
}

export interface BuildSchematicArgs {
  title: string;
  vehicle: SchematicVehicleGeometry;
  caravan?: SchematicCaravanGeometry | null;
  vehicleAccessories: SchematicAccessory[];
  caravanAccessories: SchematicAccessory[];
  result: PhysicsResult;
}

export interface AxleGauge {
  id: string;
  label: string;
  /** Global mm position of the axle. */
  xMm: number;
  loadKg: number;
  limitKg: number;
  /** load / limit, clamped to [0, 1.5] for rendering headroom-and-overflow. */
  ratio: number;
  status: MetricStatus;
}

export interface AccessoryDot {
  id: string;
  /** 1-based index matching the legend. */
  n: number;
  /** Global mm position along the rig axis. */
  xMm: number;
  /** 0 (low / underbody) .. 1 (roof). Vertical hint within the body. */
  heightHint: number;
  weightKg: number;
  label: string;
  side: 'vehicle' | 'caravan';
}

export interface VehicleShape {
  kind: VehicleBodyKind;
  rearBumperMm: number;
  frontBumperMm: number;
  rearAxleMm: number;
  frontAxleMm: number;
  hitchMm: number;
}

export interface CaravanShape {
  kind: CaravanBodyKind;
  /** Far (rear) end of the van body, global mm (leftmost). */
  bodyRearMm: number;
  /** Front of the van body where the drawbar begins, global mm. */
  bodyFrontMm: number;
  /** Coupling point (meets vehicle hitch), global mm. */
  couplingMm: number;
  /** One entry per physical axle, global mm. */
  axleMms: number[];
}

export interface SchematicModel {
  title: string;
  overallStatus: PhysicsResult['overallStatus'];
  /** Global mm bounds of the whole rig, for viewBox normalisation. */
  minXMm: number;
  maxXMm: number;
  vehicle: VehicleShape;
  caravan?: CaravanShape;
  axles: AxleGauge[];
  dots: AccessoryDot[];
}

function vehicleBodyKind(bodyType?: string | null): VehicleBodyKind {
  const t = (bodyType ?? '').toUpperCase();
  if (t.includes('UTE')) return 'ute';
  if (t.includes('VAN') || t.includes('TROOP')) return 'van';
  return 'wagon'; // WAGON, SUV, OTHER
}

function caravanBodyKind(bodyType?: string | null): CaravanBodyKind {
  const t = (bodyType ?? '').toUpperCase();
  if (t.includes('POP')) return 'poptop';
  if (t.includes('CAMPER') || t.includes('HYBRID')) return 'camper';
  return 'caravan';
}

// Vertical placement hint for an accessory dot, 0 (low) .. 1 (roof).
function heightHintFor(location: MountingLocation): number {
  const l = location;
  if (
    l.includes('ROOF') ||
    l === 'BONNET' ||
    l === 'WINDSCREEN' ||
    l === 'SNORKEL'
  )
    return 0.95;
  if (l.includes('UNDERBODY') || l.includes('CHASSIS') || l === 'TOW_HITCH')
    return 0.12;
  if (l === 'BULL_BAR' || l === 'REAR_BAR' || l === 'CARAVAN_BUMPER_BAR')
    return 0.3;
  if (l.includes('TRAY') || l.includes('TUB') || l.includes('CANOPY'))
    return 0.55;
  return 0.5;
}

// Turn an enum-ish mounting location into a short human label.
export function locationLabel(location: string): string {
  return location
    .toLowerCase()
    .replace(/^caravan_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ratioOf(loadKg: number, limitKg: number): number {
  if (limitKg <= 0) return 0;
  return Math.max(0, Math.min(1.5, loadKg / limitKg));
}

/**
 * Build the schematic layout. Returns null if essential vehicle geometry is
 * missing (no wheelbase) — the caller should skip rendering rather than draw
 * something misleading.
 */
export function buildSchematicModel(
  args: BuildSchematicArgs,
): SchematicModel | null {
  const { vehicle, caravan, result } = args;
  if (!vehicle.wheelbaseMm || vehicle.wheelbaseMm <= 0) return null;

  const wb = vehicle.wheelbaseMm;
  const frontOverhang = vehicle.frontOverhangMm ?? 900;
  const rearOverhang = vehicle.rearOverhangMm ?? 1100;

  // Anchor the vehicle: rear axle at global 0, +x toward the front (right).
  const rearAxleMm = 0;
  const frontAxleMm = wb;
  const rearBumperMm = -rearOverhang;
  const frontBumperMm = wb + frontOverhang;
  // Tow hitch sits at the rear, matching position-map's TOW_HITCH (= -rearOverhang).
  const hitchMm = -rearOverhang;

  const vehicleShape: VehicleShape = {
    kind: vehicleBodyKind(vehicle.bodyType),
    rearBumperMm,
    frontBumperMm,
    rearAxleMm,
    frontAxleMm,
    hitchMm,
  };

  const axles: AxleGauge[] = [
    {
      id: 'front',
      label: 'Front',
      xMm: frontAxleMm,
      loadKg: result.vehicle.frontAxleKg,
      limitKg: result.vehicle.frontAxleLimitKg,
      ratio: ratioOf(
        result.vehicle.frontAxleKg,
        result.vehicle.frontAxleLimitKg,
      ),
      status: result.vehicle.frontAxleStatus,
    },
    {
      id: 'rear',
      label: 'Rear',
      xMm: rearAxleMm,
      loadKg: result.vehicle.rearAxleKg,
      limitKg: result.vehicle.rearAxleLimitKg,
      ratio: ratioOf(result.vehicle.rearAxleKg, result.vehicle.rearAxleLimitKg),
      status: result.vehicle.rearAxleStatus,
    },
  ];

  const dots: AccessoryDot[] = [];
  let n = 0;
  for (const acc of args.vehicleAccessories) {
    const xPhysics = resolveVehiclePositionMm(acc.mountingLocation, {
      wheelbaseMm: wb,
      frontOverhangMm: frontOverhang,
      rearOverhangMm: rearOverhang,
    } as never);
    dots.push({
      id: acc.id,
      n: ++n,
      xMm: xPhysics, // vehicle physics x is already global (rear axle = 0)
      heightHint: heightHintFor(acc.mountingLocation),
      weightKg: acc.weightKg,
      label: acc.label || locationLabel(acc.mountingLocation),
      side: 'vehicle',
    });
  }

  let caravanShape: CaravanShape | undefined;

  if (caravan && result.caravan) {
    const couplingToAxle = caravan.couplingToAxleMm;
    const overall = caravan.overallLengthMm ?? couplingToAxle * 1.8;
    const body = caravan.bodyLengthMm ?? couplingToAxle * 1.25;
    // Drawbar length = overall minus body (clamped sensibly).
    const drawbar = Math.max(200, Math.min(overall - body, couplingToAxle));

    // Caravan extends LEFT of the hitch: global = hitchMm - caravanPhysicsX.
    const couplingMm = hitchMm;
    const bodyFrontMm = hitchMm - drawbar;
    const bodyRearMm = hitchMm - (drawbar + body);

    // Axle positions: dual/triple straddle the nominal axle by the spacing.
    const nominalAxleMm = hitchMm - couplingToAxle;
    const cfg = caravan.axleConfiguration;
    const spacing = caravan.axleSpacingMm ?? 1000;
    let axleMms: number[];
    if (cfg === 'TRIPLE_AXLE') {
      axleMms = [
        nominalAxleMm + spacing,
        nominalAxleMm,
        nominalAxleMm - spacing,
      ];
    } else if (cfg.startsWith('DUAL')) {
      axleMms = [nominalAxleMm + spacing / 2, nominalAxleMm - spacing / 2];
    } else {
      axleMms = [nominalAxleMm];
    }

    caravanShape = {
      kind: caravanBodyKind(caravan.bodyType),
      bodyRearMm,
      bodyFrontMm,
      couplingMm,
      axleMms,
    };

    // Caravan axle gauge. Per-axle load is the engine's split (currently even);
    // we render one gauge per physical axle so the picture matches the metrics.
    const cr = result.caravan;
    const perAxleLoad =
      cr.axle1Kg != null ? cr.axle1Kg : cr.gtmKg / axleMms.length;
    const perAxleLimit =
      cr.axle1LimitKg != null
        ? cr.axle1LimitKg
        : cr.gtmLimitKg / axleMms.length;
    const perAxleStatus: MetricStatus = cr.axle1Status ?? cr.gtmStatus;
    axleMms.forEach((xMm, i) => {
      axles.push({
        id: `caravan-${i}`,
        label: axleMms.length > 1 ? `Van ${i + 1}` : 'Van',
        xMm,
        loadKg: perAxleLoad,
        limitKg: perAxleLimit,
        ratio: ratioOf(perAxleLoad, perAxleLimit),
        status: perAxleStatus,
      });
    });

    for (const acc of args.caravanAccessories) {
      const xPhysics = resolveCaravanPositionMm(acc.mountingLocation, {
        couplingToAxleMm: couplingToAxle,
      } as never);
      dots.push({
        id: acc.id,
        n: ++n,
        xMm: hitchMm - xPhysics,
        heightHint: heightHintFor(acc.mountingLocation),
        weightKg: acc.weightKg,
        label: acc.label || locationLabel(acc.mountingLocation),
        side: 'caravan',
      });
    }
  }

  // Global bounds across everything we draw.
  const xs: number[] = [
    vehicleShape.rearBumperMm,
    vehicleShape.frontBumperMm,
    ...dots.map((d) => d.xMm),
  ];
  if (caravanShape) {
    xs.push(caravanShape.bodyRearMm, caravanShape.couplingMm);
  }
  const minXMm = Math.min(...xs);
  const maxXMm = Math.max(...xs);

  return {
    title: args.title,
    overallStatus: result.overallStatus,
    minXMm,
    maxXMm,
    vehicle: vehicleShape,
    caravan: caravanShape,
    axles,
    dots,
  };
}
