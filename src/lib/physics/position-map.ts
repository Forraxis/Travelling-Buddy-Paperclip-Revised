import type { MountingLocation, VehicleInput, CaravanInput } from './types';

/** Default track width (centre-to-centre of tyres), mm, when unknown. */
export const DEFAULT_TRACK_WIDTH_MM = 1650;

/** Default caravan track width (tyre centres), mm, when unknown. */
export const DEFAULT_CARAVAN_TRACK_WIDTH_MM = 1750;

// Caravan lateral (left/right) default from the centreline, mm. + = right. Most
// van loads sit central; wall-left/right mounts bias to their side. A
// user-supplied cogY (set in the layout editor) overrides this.
export function resolveCaravanLateralMm(
  location: MountingLocation,
  trackWidthMm: number,
): number {
  const side = trackWidthMm * 0.38;
  if (location.endsWith('_LEFT')) return -side;
  if (location.endsWith('_RIGHT')) return side;
  return 0;
}

// Lateral (left/right) default position from the centreline, mm. + = right.
// Most accessories sit on the centreline; side-specific mounts bias to their
// side at roughly 38% of the track. A user-supplied cogY overrides this.
export function resolveVehicleLateralMm(
  location: MountingLocation,
  vehicle: VehicleInput,
): number {
  const track = vehicle.trackWidthMm ?? DEFAULT_TRACK_WIDTH_MM;
  const side = track * 0.38;
  if (location.endsWith('_LEFT')) return -side;
  if (location.endsWith('_RIGHT')) return side;
  return 0;
}

/** Default vehicle CoG height above ground (mm) when a load's height is unknown. */
export const DEFAULT_VEHICLE_COG_HEIGHT_MM = 700;

// Vertical CoG height above ground, mm, per mounting location — feeds the
// (advisory) combined CoG-height / static-stability estimate. PROVISIONAL:
// typical 4WD/ute estimates pending the Rule-11 sign-off in STABILITY_SIGNOFF.md.
// A user-supplied cogZMm overrides this. Height does NOT affect axle loads.
export function resolveVehicleHeightMm(location: MountingLocation): number {
  switch (location) {
    case 'ROOF_RACK':
    case 'ROOF_RAILS':
    case 'CABIN_ROOF':
    case 'CANOPY_ROOF':
      return 1950;
    case 'SNORKEL':
      return 1700;
    case 'WINDSCREEN':
    case 'A_PILLAR_LEFT':
    case 'A_PILLAR_RIGHT':
      return 1500;
    case 'CANOPY_INTERIOR':
    case 'CANOPY_EXTERIOR':
      return 1300;
    case 'BONNET':
      return 1100;
    case 'CABIN_INTERIOR':
    case 'CABIN_DASH':
    case 'DOOR_LEFT':
    case 'DOOR_RIGHT':
    case 'TRAY_FLOOR':
    case 'TRAY_SIDE_LEFT':
    case 'TRAY_SIDE_RIGHT':
    case 'TRAY_HEADBOARD':
    case 'TRAY_TAILGATE':
    case 'TUB_INTERIOR':
    case 'TUB_EXTERIOR':
      return 950;
    case 'FENDER_LEFT':
    case 'FENDER_RIGHT':
    case 'WHEEL_ARCH_LEFT':
    case 'WHEEL_ARCH_RIGHT':
      return 850;
    case 'BULL_BAR':
      return 650;
    case 'CHASSIS_FRONT':
    case 'CHASSIS_MID':
    case 'CHASSIS_REAR':
      return 600;
    case 'REAR_BAR':
    case 'TOW_HITCH':
      return 500;
    case 'UNDERBODY_FRONT':
    case 'UNDERBODY_MID':
    case 'UNDERBODY_REAR':
      return 350;
    default:
      return DEFAULT_VEHICLE_COG_HEIGHT_MM;
  }
}

// Vehicle: x=0 at rear axle, positive forward toward front axle.
// Returns mm from rear axle.
export function resolveVehiclePositionMm(
  location: MountingLocation,
  vehicle: VehicleInput,
): number {
  const wb = vehicle.wheelbaseMm;
  const rearOverhang = vehicle.rearOverhangMm ?? 400;
  const frontOverhang = vehicle.frontOverhangMm ?? 800;

  switch (location) {
    case 'BULL_BAR':
      return wb + frontOverhang * 0.5;
    case 'CHASSIS_FRONT':
    case 'UNDERBODY_FRONT':
      return wb * 0.95;
    case 'BONNET':
    case 'WINDSCREEN':
    case 'SNORKEL':
      return wb * 0.9;
    case 'FENDER_LEFT':
    case 'FENDER_RIGHT':
      return wb * 0.82;
    case 'A_PILLAR_LEFT':
    case 'A_PILLAR_RIGHT':
      return wb * 0.85;
    case 'CABIN_ROOF':
    case 'CABIN_INTERIOR':
    case 'CABIN_DASH':
    case 'DOOR_LEFT':
    case 'DOOR_RIGHT':
      return wb * 0.65;
    case 'ROOF_RACK':
    case 'ROOF_RAILS':
      return wb * 0.55;
    case 'CHASSIS_MID':
    case 'UNDERBODY_MID':
      return wb * 0.5;
    case 'WHEEL_ARCH_LEFT':
    case 'WHEEL_ARCH_RIGHT':
      return wb * 0.15;
    case 'TRAY_HEADBOARD':
      return wb * 0.1;
    case 'TUB_INTERIOR':
    case 'TUB_EXTERIOR':
      return wb * 0.1;
    case 'CANOPY_ROOF':
    case 'CANOPY_INTERIOR':
    case 'CANOPY_EXTERIOR':
      return wb * 0.08;
    case 'TRAY_FLOOR':
    case 'TRAY_SIDE_LEFT':
    case 'TRAY_SIDE_RIGHT':
      return wb * 0.05;
    case 'TRAY_TAILGATE':
      return 0;
    case 'CHASSIS_REAR':
    case 'UNDERBODY_REAR':
      return -(wb * 0.02);
    case 'REAR_BAR':
      return -(rearOverhang * 0.8);
    case 'TOW_HITCH':
      return -rearOverhang;
    default:
      // Caravan locations should never be resolved against a vehicle.
      // Fall back to mid-vehicle as a safe default.
      return wb * 0.5;
  }
}

// Caravan: x=0 at coupling (hitch point), positive rearward.
// Axle is at x=couplingToAxleMm.
// Items forward of axle (x < axleX) increase TBM.
// Items rearward of axle (x > axleX) decrease TBM.
// Returns mm from coupling.
export function resolveCaravanPositionMm(
  location: MountingLocation,
  caravan: CaravanInput,
): number {
  const ax = caravan.couplingToAxleMm;

  switch (location) {
    case 'CARAVAN_A_FRAME':
      return ax * 0.1;
    case 'CARAVAN_DRAWBAR':
      return ax * 0.25;
    case 'CARAVAN_CHASSIS_FRONT':
      return ax * 0.4;
    case 'CARAVAN_WALL_FRONT':
      return ax * 0.5;
    case 'CARAVAN_CHASSIS_MID':
    case 'CARAVAN_UNDERBODY':
      return ax * 0.75;
    case 'CARAVAN_WALL_LEFT':
    case 'CARAVAN_WALL_RIGHT':
    case 'CARAVAN_ROOF':
      return ax * 0.8;
    case 'CARAVAN_CHASSIS_REAR':
    case 'CARAVAN_BOOT':
      return ax * 1.1;
    case 'CARAVAN_TUNNEL_BOOT':
      return ax * 1.05;
    case 'CARAVAN_TOOLBAR_INTERNAL':
    case 'CARAVAN_WALL_REAR':
      return ax * 1.15;
    case 'CARAVAN_BUMPER_BAR':
      return ax * 1.2;
    case 'CARAVAN_TOOLBAR_EXTERNAL':
      return ax * 1.25;
    default:
      // Vehicle locations or unknown — default to axle position (zero TBM contribution).
      return ax;
  }
}
