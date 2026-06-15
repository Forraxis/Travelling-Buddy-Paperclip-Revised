import type { MountingLocation } from '@/lib/physics/types';

// Real-world footprint of an accessory for the top-down view, so gear renders as
// a sized box rather than a dot — you can see a roof rack spans the cabin and a
// bull bar runs the full width. Length is along the rig's longitudinal axis (X),
// width is lateral (Y). No catalogue dimensions yet, so these are sensible
// per-mount defaults, gently scaled by mass; a future Accessory.footprint field
// (collected via the community pipeline) would override these.

export interface Footprint {
  /** Longitudinal extent (along X), mm. */
  lengthMm: number;
  /** Lateral extent (along Y), mm. */
  widthMm: number;
}

// Base footprints keyed by the kind of mount. Width-dominant items (bars) are
// shallow and wide; long items (racks, drawers) run fore-aft.
const BASE: Array<{ test: (l: string) => boolean; fp: Footprint }> = [
  { test: (l) => l === 'BULL_BAR' || l === 'REAR_BAR', fp: { lengthMm: 320, widthMm: 1700 } },
  { test: (l) => l === 'CARAVAN_BUMPER_BAR', fp: { lengthMm: 300, widthMm: 1900 } },
  { test: (l) => l.includes('ROOF'), fp: { lengthMm: 1300, widthMm: 1150 } },
  { test: (l) => l === 'SNORKEL', fp: { lengthMm: 140, widthMm: 160 } },
  { test: (l) => l === 'BONNET' || l === 'WINDSCREEN', fp: { lengthMm: 400, widthMm: 700 } },
  { test: (l) => l.startsWith('TRAY') || l.startsWith('TUB'), fp: { lengthMm: 900, widthMm: 1100 } },
  { test: (l) => l.startsWith('CANOPY'), fp: { lengthMm: 1400, widthMm: 1500 } },
  { test: (l) => l === 'TOW_HITCH' || l === 'TOW_BAR', fp: { lengthMm: 260, widthMm: 320 } },
  { test: (l) => l.startsWith('UNDERBODY') || l.startsWith('CHASSIS'), fp: { lengthMm: 500, widthMm: 500 } },
  { test: (l) => l.startsWith('WHEEL_ARCH') || l.startsWith('FENDER'), fp: { lengthMm: 320, widthMm: 260 } },
  { test: (l) => l.startsWith('DOOR') || l.startsWith('A_PILLAR'), fp: { lengthMm: 300, widthMm: 200 } },
  { test: (l) => l.startsWith('CABIN'), fp: { lengthMm: 700, widthMm: 900 } },
];

const DEFAULT_FP: Footprint = { lengthMm: 450, widthMm: 450 };

/**
 * Footprint for an accessory. Picks a per-mount base shape, then nudges it by a
 * mild mass factor (a 90 kg drawer system reads bigger than a 5 kg light bar)
 * while clamping so nothing renders absurdly large.
 */
export function accessoryFootprint(
  location: MountingLocation | string,
  weightKg: number,
): Footprint {
  const base = BASE.find((b) => b.test(location))?.fp ?? DEFAULT_FP;
  // Mass factor: 1.0 at ~20 kg, ramps gently, capped at 1.4.
  const factor = Math.min(1.4, Math.max(0.7, Math.sqrt(Math.max(1, weightKg) / 20)));
  return {
    lengthMm: Math.round(base.lengthMm * factor),
    widthMm: Math.round(base.widthMm * factor),
  };
}
