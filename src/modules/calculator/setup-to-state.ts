import type {
  CalculatorState,
  AccessorySelection,
  CustomLoad,
  CalibrationState,
} from './types';
import { INITIAL_STATE, DEFAULT_JOURNEY } from './types';

// Loose shape of the GET /api/setups/[id] response we depend on. The route
// returns the full Prisma setup; we read only these fields.
interface SetupAccessoryDTO {
  fitmentId: string;
  cogXMmOverride?: number | null;
  cogYMmOverride?: number | null;
  cogZMmOverride?: number | null;
  positionUnlocked?: boolean | null;
  fitment?: {
    installedWeightKg?: number | string | null;
    mountingLocation?: string | null;
    accessory?: {
      name?: string | null;
      topDownImageUrl?: string | null;
    } | null;
  } | null;
}

interface SetupCustomLoadDTO {
  id: string;
  label: string;
  weightKg: number | string;
  cogXMm?: number | null;
  cogYMm?: number | null;
  cogZMm?: number | null;
  side?: 'VEHICLE' | 'CARAVAN' | 'BOTH' | null;
  footprintLengthMm?: number | null;
  footprintWidthMm?: number | null;
  isUnaccounted?: boolean | null;
}

export interface SetupDTO {
  vehicleVariantId?: string | null;
  caravanVariantId?: string | null;
  passengers?: number | null;
  cargoKg?: number | string | null;
  fuelPercent?: number | null;
  freshWaterPercent?: number | null;
  greyWaterPercent?: number | null;
  accessories?: SetupAccessoryDTO[] | null;
  caravanAccessories?: SetupAccessoryDTO[] | null;
  customLoads?: SetupCustomLoadDTO[] | null;
  calibrationOverrides?: { weighbridge?: CalibrationState } | null;
}

function mapAccessory(a: SetupAccessoryDTO): AccessorySelection {
  return {
    // `accessoryId` in calculator state is the fitment id (the save payload
    // sends it back as fitmentId), so it must round-trip as the fitment id.
    accessoryId: a.fitmentId,
    massKg: Number(a.fitment?.installedWeightKg ?? 0),
    mountingLocation: a.fitment?.mountingLocation ?? '',
    label: a.fitment?.accessory?.name ?? undefined,
    cogXMm: a.cogXMmOverride ?? null,
    cogYMm: a.cogYMmOverride ?? null,
    cogZMm: a.cogZMmOverride ?? null,
    positionUnlocked: a.positionUnlocked ?? false,
    topDownImageUrl: a.fitment?.accessory?.topDownImageUrl ?? null,
  };
}

function mapCustomLoad(l: SetupCustomLoadDTO): CustomLoad {
  return {
    id: l.id,
    label: l.label,
    massKg: Number(l.weightKg),
    side: l.side === 'CARAVAN' ? 'caravan' : 'vehicle',
    cogXMm: l.cogXMm ?? null,
    cogYMm: l.cogYMm ?? null,
    cogZMm: l.cogZMm ?? null,
    footprintLengthMm: l.footprintLengthMm ?? null,
    footprintWidthMm: l.footprintWidthMm ?? null,
    isUnaccounted: l.isUnaccounted ?? false,
  };
}

/**
 * Reconstruct full calculator state from a saved DB setup so it loads back into
 * an editing session — including custom loads + weighbridge calibration, which
 * the URL round-trip (`stateToParams`) drops. Used by the `?setupId=` loader and
 * (P2) version revert. Note: `caravanAssumptions` is not stored on the DB Setup
 * (it is URL-only today), so it stays at defaults here.
 */
export function setupToCalculatorState(setup: SetupDTO): CalculatorState {
  const customLoads = (setup.customLoads ?? []).map(mapCustomLoad);

  // Re-link the calibration's unaccounted load to its reconstructed id (the
  // stored id was a client-side id from before the save).
  let calibration: CalibrationState | null =
    setup.calibrationOverrides?.weighbridge ?? null;
  if (calibration) {
    const unaccounted = customLoads.find((l) => l.isUnaccounted);
    calibration = {
      ...calibration,
      unaccountedLoadId: unaccounted?.id ?? null,
    };
  }

  return {
    ...INITIAL_STATE,
    vehicleVariantId: setup.vehicleVariantId ?? null,
    caravanVariantId: setup.caravanVariantId ?? null,
    journey: {
      ...DEFAULT_JOURNEY,
      passengers: setup.passengers ?? DEFAULT_JOURNEY.passengers,
      cargoKg: Number(setup.cargoKg ?? DEFAULT_JOURNEY.cargoKg),
      fuelPercent: setup.fuelPercent ?? DEFAULT_JOURNEY.fuelPercent,
      freshWaterPercent:
        setup.freshWaterPercent ?? DEFAULT_JOURNEY.freshWaterPercent,
      greyWaterPercent:
        setup.greyWaterPercent ?? DEFAULT_JOURNEY.greyWaterPercent,
    },
    accessories: (setup.accessories ?? []).map(mapAccessory),
    caravanAccessories: (setup.caravanAccessories ?? []).map(mapAccessory),
    customLoads,
    calibration,
  };
}
