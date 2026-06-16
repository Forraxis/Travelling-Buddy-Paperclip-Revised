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
  resolveVehicleLateralMm,
  resolveVehicleHeightMm,
} from '@/lib/physics/position-map';

/** Top of the height range the side view maps onto (mm above ground). */
export const SCHEMATIC_MAX_HEIGHT_MM = 2200;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
import { vehicleProfile, caravanProfile } from './vehicle-profiles';
import { accessoryFootprint } from './accessory-footprint';
import { iconForMount, type IconId } from './accessory-icons';

export type VehicleBodyKind = 'ute' | 'wagon' | 'suv' | 'van';
export type CaravanBodyKind = 'caravan' | 'poptop' | 'camper' | 'offroad';

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
  /** Longitudinal position from rear axle, mm. Overrides the template. */
  cogXMm?: number | null;
  /** Lateral position from centreline, mm (+ = right). Defaults per mount. */
  cogYMm?: number | null;
  /** Vertical CoG height (mm above ground). Defaults from the mounting location. */
  cogZMm?: number | null;
  label?: string | null;
  /** Explicit footprint (mm) — overrides the per-mount default (custom loads). */
  footprintLengthMm?: number | null;
  footprintWidthMm?: number | null;
  /** Object height (mm) — for the side-view 3D box (custom loads). */
  footprintHeightMm?: number | null;
  /** Basic preset silhouette (custom loads): box | cylinder | drawer | toolbox | lshape. */
  shape?: string | null;
  /** Real top-down image URL — overrides the category icon. */
  topDownImageUrl?: string | null;
  /** Weighbridge "unaccounted" residual — rendered distinctly on the top-down. */
  isUnaccounted?: boolean;
  /** Position is editable (a custom load, or an unlocked catalogue accessory). */
  editable?: boolean;
  /** A user-made custom load (vs a catalogue accessory). */
  isCustom?: boolean;
}

export interface BuildSchematicArgs {
  title: string;
  vehicle: SchematicVehicleGeometry;
  caravan?: SchematicCaravanGeometry | null;
  vehicleAccessories: SchematicAccessory[];
  caravanAccessories: SchematicAccessory[];
  result: PhysicsResult;
  vehicleSlug?: string;
  caravanSlug?: string;
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
  /** Lateral position from centreline, mm (+ = right) — for the top-down view. */
  yMm: number;
  /** Longitudinal extent (along X), mm — sized footprint for the top-down view. */
  footprintLengthMm: number;
  /** Lateral extent (along Y), mm — sized footprint for the top-down view. */
  footprintWidthMm: number;
  /** Category glyph id for the top-down marker. */
  iconId: IconId;
  /** Real top-down image URL — overrides the glyph when set. */
  topDownImageUrl?: string | null;
  /** Weighbridge "unaccounted" residual — rendered distinctly (tint/dash). */
  isUnaccounted?: boolean;
  /** Effective vertical CoG height (mm above ground) — drives the side view + drag. */
  cogZMm: number;
  /** Object height (mm), if known — sizes the side-view box for custom loads. */
  footprintHeightMm?: number | null;
  /** Basic preset silhouette (custom loads). */
  shape?: string | null;
  /** Position is editable (custom load, or unlocked catalogue accessory). */
  editable: boolean;
  /** A user-made custom load (vs a catalogue accessory). */
  isCustom: boolean;
}

/** A labelled longitudinal mounting band, in global mm, for the top-down view. */
export interface SchematicZone {
  id: string;
  label: string;
  x0Mm: number;
  x1Mm: number;
}

export interface VehicleShape {
  kind: VehicleBodyKind;
  rearBumperMm: number;
  frontBumperMm: number;
  rearAxleMm: number;
  frontAxleMm: number;
  hitchMm: number;
  /** Body width, mm — for the top-down view. */
  widthMm: number;
  /** Track width (tyre centres), mm. */
  trackWidthMm: number;
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
  /** Body width, mm — for the top-down view. */
  widthMm: number;
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
  /** Vehicle mounting zones (global mm) for the top-down view. */
  zones: SchematicZone[];
  /** Lateral distribution for the top-down view (from the physics result). */
  lateral?: PhysicsResult['vehicle']['lateral'];
  /** Caravan lateral (left/right) distribution — for the coupled-rig editor. */
  caravanLateral?: NonNullable<PhysicsResult['caravan']>['lateral'];
  /** Slugs of the current rig, so the UI can deep-link to the full layout planner. */
  vehicleSlug?: string;
  caravanSlug?: string;
}

function vehicleBodyKind(bodyType?: string | null): VehicleBodyKind {
  const t = (bodyType ?? '').toUpperCase();
  if (t.includes('UTE')) return 'ute';
  if (t.includes('VAN') || t.includes('TROOP')) return 'van';
  if (t.includes('SUV')) return 'suv';
  return 'wagon'; // WAGON, OTHER
}

function caravanBodyKind(bodyType?: string | null): CaravanBodyKind {
  const t = (bodyType ?? '').toUpperCase();
  if (t.includes('POP')) return 'poptop';
  if (t.includes('CAMPER') || t.includes('HYBRID')) return 'camper';
  if (t.includes('OFF') || t.includes('ROAD')) return 'offroad';
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

  const vKind = vehicleBodyKind(vehicle.bodyType);
  const vProfile = vehicleProfile(vKind);
  const vehicleShape: VehicleShape = {
    kind: vKind,
    rearBumperMm,
    frontBumperMm,
    rearAxleMm,
    frontAxleMm,
    hitchMm,
    widthMm: vProfile.bodyWidthMm,
    trackWidthMm: vProfile.trackWidthMm,
  };
  const lateralResolverVehicle = {
    trackWidthMm: vProfile.trackWidthMm,
  } as never;

  // Resolve the profile's fractional mounting zones into global mm.
  const bodySpan = frontBumperMm - rearBumperMm;
  const zones: SchematicZone[] = vProfile.zones.map((z) => ({
    id: z.id,
    label: z.label,
    x0Mm: rearBumperMm + z.x0 * bodySpan,
    x1Mm: rearBumperMm + z.x1 * bodySpan,
  }));

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
    const xPhysics =
      acc.cogXMm != null
        ? acc.cogXMm
        : resolveVehiclePositionMm(acc.mountingLocation, {
            wheelbaseMm: wb,
            frontOverhangMm: frontOverhang,
            rearOverhangMm: rearOverhang,
          } as never);
    const yMm =
      acc.cogYMm != null
        ? acc.cogYMm
        : resolveVehicleLateralMm(acc.mountingLocation, lateralResolverVehicle);
    const fp =
      acc.footprintLengthMm != null && acc.footprintWidthMm != null
        ? { lengthMm: acc.footprintLengthMm, widthMm: acc.footprintWidthMm }
        : accessoryFootprint(acc.mountingLocation, acc.weightKg);
    // Effective height drives both the side-view dot position and the drag.
    const cogZMm =
      acc.cogZMm != null
        ? acc.cogZMm
        : resolveVehicleHeightMm(acc.mountingLocation);
    dots.push({
      id: acc.id,
      n: ++n,
      xMm: xPhysics, // vehicle physics x is already global (rear axle = 0)
      heightHint: clamp01(cogZMm / SCHEMATIC_MAX_HEIGHT_MM),
      cogZMm,
      weightKg: acc.weightKg,
      label: acc.label || locationLabel(acc.mountingLocation),
      side: 'vehicle',
      yMm,
      footprintLengthMm: fp.lengthMm,
      footprintWidthMm: fp.widthMm,
      iconId: iconForMount(acc.mountingLocation, acc.label),
      topDownImageUrl: acc.topDownImageUrl,
      isUnaccounted: acc.isUnaccounted,
      footprintHeightMm: acc.footprintHeightMm,
      shape: acc.shape,
      editable: acc.editable ?? false,
      isCustom: acc.isCustom ?? false,
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

    const cKind = caravanBodyKind(caravan.bodyType);
    caravanShape = {
      kind: cKind,
      bodyRearMm,
      bodyFrontMm,
      couplingMm,
      axleMms,
      widthMm: caravanProfile(cKind).bodyWidthMm,
    };

    // One gauge per physical axle, using the engine's per-axle split. axleMms
    // and result.caravan.axles are both ordered front (nearest coupling) → rear,
    // so they map by index. Fallback to an even share if axles is unexpectedly
    // empty so the gauge still renders.
    const cr = result.caravan;
    axleMms.forEach((xMm, i) => {
      const a = cr.axles[i];
      const loadKg = a ? a.loadKg : cr.gtmKg / axleMms.length;
      const limitKg = a ? a.limitKg : cr.gtmLimitKg / axleMms.length;
      const status: MetricStatus = a ? a.status : cr.gtmStatus;
      axles.push({
        id: `caravan-${i}`,
        label: axleMms.length > 1 ? `Van ${i + 1}` : 'Van',
        xMm,
        loadKg,
        limitKg,
        ratio: ratioOf(loadKg, limitKg),
        status,
      });
    });

    for (const acc of args.caravanAccessories) {
      const xPhysics =
        acc.cogXMm != null
          ? acc.cogXMm
          : resolveCaravanPositionMm(acc.mountingLocation, {
              couplingToAxleMm: couplingToAxle,
            } as never);
      const fp =
        acc.footprintLengthMm != null && acc.footprintWidthMm != null
          ? { lengthMm: acc.footprintLengthMm, widthMm: acc.footprintWidthMm }
          : accessoryFootprint(acc.mountingLocation, acc.weightKg);
      const hint = heightHintFor(acc.mountingLocation);
      dots.push({
        id: acc.id,
        n: ++n,
        xMm: hitchMm - xPhysics,
        heightHint: hint,
        cogZMm: acc.cogZMm ?? hint * SCHEMATIC_MAX_HEIGHT_MM,
        weightKg: acc.weightKg,
        label: acc.label || locationLabel(acc.mountingLocation),
        side: 'caravan',
        yMm: acc.cogYMm ?? 0,
        footprintLengthMm: fp.lengthMm,
        footprintWidthMm: fp.widthMm,
        iconId: iconForMount(acc.mountingLocation, acc.label),
        topDownImageUrl: acc.topDownImageUrl,
        isUnaccounted: acc.isUnaccounted,
        footprintHeightMm: acc.footprintHeightMm,
        shape: acc.shape,
        editable: acc.editable ?? false,
        isCustom: acc.isCustom ?? false,
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
    zones,
    lateral: result.vehicle.lateral,
    caravanLateral: result.caravan?.lateral,
    vehicleSlug: args.vehicleSlug,
    caravanSlug: args.caravanSlug,
  };
}
