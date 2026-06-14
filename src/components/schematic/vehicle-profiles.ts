import type { VehicleBodyKind, CaravanBodyKind } from './model';

// Per-body-type "profile" — the swappable layer that lets the rig system handle
// cars, utes, wagons, vans, etc. The PHYSICS is body-agnostic (same statics);
// only these dimensions + (elsewhere) the silhouette and positionable zones
// change per type. Track/width aren't in the catalogue yet, so they're sensible
// estimates per body type — refine later via the community data pipeline.

export interface VehicleProfile {
  /** Track width (centre-to-centre of tyres), mm — feeds the lateral physics. */
  trackWidthMm: number;
  /** Body width for the top-down silhouette, mm (wider than track). */
  bodyWidthMm: number;
}

const VEHICLE_PROFILES: Record<VehicleBodyKind, VehicleProfile> = {
  ute: { trackWidthMm: 1620, bodyWidthMm: 1900 },
  wagon: { trackWidthMm: 1640, bodyWidthMm: 1980 },
  suv: { trackWidthMm: 1610, bodyWidthMm: 1900 },
  van: { trackWidthMm: 1760, bodyWidthMm: 2100 },
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
