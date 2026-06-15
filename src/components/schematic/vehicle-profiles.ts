import type { VehicleBodyKind, CaravanBodyKind } from './model';

// Per-body-type "profile" — the swappable layer that lets the rig system handle
// cars, utes, wagons, vans, etc. The PHYSICS is body-agnostic (same statics);
// only these dimensions + (elsewhere) the silhouette and positionable zones
// change per type. Track/width aren't in the catalogue yet, so they're sensible
// estimates per body type — refine later via the community data pipeline.

/** A longitudinal mounting region, as fractions from rear bumper (0) → front
 *  bumper (1). The top-down view draws these as labelled bands and snaps drags
 *  to the nearest one, so a placement reads as "in the tub" / "on the bull bar"
 *  rather than a bare millimetre. */
export interface ZoneBand {
  id: string;
  label: string;
  x0: number;
  x1: number;
}

export interface VehicleProfile {
  /** Track width (centre-to-centre of tyres), mm — feeds the lateral physics. */
  trackWidthMm: number;
  /** Body width for the top-down silhouette, mm (wider than track). */
  bodyWidthMm: number;
  /** Mounting zones along the body, rear → front. */
  zones: ZoneBand[];
}

// Zone presets per body kind. Fractions run rear bumper (0) → front bumper (1).
const UTE_ZONES: ZoneBand[] = [
  { id: 'tow', label: 'Tow', x0: 0, x1: 0.08 },
  { id: 'tub', label: 'Tub', x0: 0.08, x1: 0.42 },
  { id: 'cabin', label: 'Cabin', x0: 0.42, x1: 0.62 },
  { id: 'engine', label: 'Engine bay', x0: 0.62, x1: 0.86 },
  { id: 'bar', label: 'Bull bar', x0: 0.86, x1: 1 },
];
const WAGON_ZONES: ZoneBand[] = [
  { id: 'tow', label: 'Tow', x0: 0, x1: 0.1 },
  { id: 'boot', label: 'Boot', x0: 0.1, x1: 0.36 },
  { id: 'cabin', label: 'Cabin', x0: 0.36, x1: 0.62 },
  { id: 'engine', label: 'Engine bay', x0: 0.62, x1: 0.86 },
  { id: 'bar', label: 'Front bar', x0: 0.86, x1: 1 },
];
const VAN_ZONES: ZoneBand[] = [
  { id: 'tow', label: 'Tow', x0: 0, x1: 0.08 },
  { id: 'cargo', label: 'Cargo', x0: 0.08, x1: 0.5 },
  { id: 'cabin', label: 'Cabin', x0: 0.5, x1: 0.72 },
  { id: 'engine', label: 'Engine bay', x0: 0.72, x1: 0.88 },
  { id: 'bar', label: 'Front bar', x0: 0.88, x1: 1 },
];

const VEHICLE_PROFILES: Record<VehicleBodyKind, VehicleProfile> = {
  ute: { trackWidthMm: 1620, bodyWidthMm: 1900, zones: UTE_ZONES },
  wagon: { trackWidthMm: 1640, bodyWidthMm: 1980, zones: WAGON_ZONES },
  suv: { trackWidthMm: 1610, bodyWidthMm: 1900, zones: WAGON_ZONES },
  van: { trackWidthMm: 1760, bodyWidthMm: 2100, zones: VAN_ZONES },
};

export function vehicleProfile(kind: VehicleBodyKind): VehicleProfile {
  return VEHICLE_PROFILES[kind] ?? VEHICLE_PROFILES.wagon;
}

export interface CaravanProfile {
  bodyWidthMm: number;
}

const CARAVAN_PROFILES: Record<CaravanBodyKind, CaravanProfile> = {
  caravan: { bodyWidthMm: 2300 },
  offroad: { bodyWidthMm: 2250 },
  poptop: { bodyWidthMm: 2200 },
  camper: { bodyWidthMm: 2000 },
};

export function caravanProfile(kind: CaravanBodyKind): CaravanProfile {
  return CARAVAN_PROFILES[kind] ?? CARAVAN_PROFILES.caravan;
}

/** Map a DB body-type enum to the silhouette/profile vehicle kind. */
export function vehicleBodyKindFromType(
  bodyType?: string | null,
): VehicleBodyKind {
  const t = (bodyType ?? '').toUpperCase();
  if (t.includes('UTE')) return 'ute';
  if (t.includes('VAN') || t.includes('TROOP')) return 'van';
  if (t.includes('SUV')) return 'suv';
  return 'wagon';
}
