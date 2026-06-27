import type {
  WeighbridgeMeasurement,
  CalibrationStaticOffsets,
} from '@/lib/physics/calibration';

export interface JourneyAssumptions {
  passengers: number;
  passengerWeightKg: number;
  cargoKg: number;
  fuelPercent: number;
  freshWaterPercent: number;
  greyWaterPercent: number;
  gearKg: number;
}

export interface CaravanAssumptions {
  freshWaterL: number;
  greyWaterL: number;
  gearKg: number;
}

export interface AccessorySelection {
  accessoryId: string;
  variantId?: string;
  massKg: number;
  mountingLocation: string;
  /** Display name (for the schematic label + icon matching). */
  label?: string;
  /** User-positioned longitudinal CoG (mm from rear axle). Overrides template. */
  cogXMm?: number | null;
  /** User-positioned lateral CoG (mm from centreline, + = right). */
  cogYMm?: number | null;
  /** Vertical CoG height (mm above ground). Defaults from mounting location. */
  cogZMm?: number | null;
  /**
   * Catalogue accessories are locked to their known position on add; the user
   * unlocks one to reposition it (x/y/z). Custom loads are always movable.
   */
  positionUnlocked?: boolean;
  /** Real top-down image (R2) — overrides the category icon. */
  topDownImageUrl?: string | null;
}

/** Basic preset shapes a custom item can take (top-down silhouette). */
export type LoadShape = 'box' | 'cylinder' | 'drawer' | 'toolbox' | 'lshape';

/** A user-made load (not a catalogue accessory) placed in the layout editor. */
export interface CustomLoad {
  id: string;
  label: string;
  massKg: number;
  side: 'vehicle' | 'caravan';
  cogXMm?: number | null;
  cogYMm?: number | null;
  cogZMm?: number | null;
  footprintLengthMm?: number | null;
  footprintWidthMm?: number | null;
  /** Object height (mm) — makes the item a 3D box for the side view. */
  footprintHeightMm?: number | null;
  /** Basic preset silhouette; defaults to a box. */
  shape?: LoadShape | null;
  /** The weighbridge-calibration residual mass, rendered/labelled distinctly. */
  isUnaccounted?: boolean;
}

/**
 * Weighbridge calibration anchored to this setup. The positioned "unaccounted
 * load" lives in {@link CalculatorState.customLoads} (linked by
 * `unaccountedLoadId`); this slice carries the measured ticket + the solved
 * static mop-up offsets the engine applies. Produced by `calibrateToWeighbridge`.
 * See CALIBRATION_SIGNOFF.md.
 */
export interface CalibrationState {
  measurement: WeighbridgeMeasurement;
  vehicleStaticOffsets: CalibrationStaticOffsets;
  /** id of the SetupCustomLoad / CustomLoad that is the unaccounted residual. */
  unaccountedLoadId: string | null;
  notes: string[];
}

/**
 * GVM/GCM the user confirmed from their vehicle's compliance plate (the precision
 * mechanism — CATALOGUE_GRANULARITY_PLAN.md §6). Read off a plate photo via OCR,
 * then reviewed/edited by the user before applying. When present these REPLACE the
 * catalogue (often ESTIMATE) figure in the verdict and flip the limit to CONFIRMED.
 * Per-rig + session-scoped; cleared when the vehicle changes.
 */
export interface PlateConfirmedLimits {
  gvmKg?: number | null;
  gcmKg?: number | null;
  /** ISO timestamp of when the user confirmed it. */
  capturedAt: string;
}

export interface CalculatorState {
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
  journey: JourneyAssumptions;
  caravanAssumptions: CaravanAssumptions;
  accessories: AccessorySelection[];
  caravanAccessories: AccessorySelection[];
  customLoads: CustomLoad[];
  /** Weighbridge calibration baseline, if the user has weighed this rig. */
  calibration?: CalibrationState | null;
  /** GVM/GCM confirmed from the compliance plate, if the user has done so. */
  plateConfirmed?: PlateConfirmedLimits | null;
}

export type CalculatorAction =
  | { type: 'SET_VEHICLE_VARIANT'; id: string | null }
  | { type: 'SET_CARAVAN_VARIANT'; id: string | null }
  | { type: 'SET_JOURNEY'; patch: Partial<JourneyAssumptions> }
  | { type: 'SET_CARAVAN_ASSUMPTIONS'; patch: Partial<CaravanAssumptions> }
  | { type: 'ADD_ACCESSORY'; accessory: AccessorySelection }
  | { type: 'REMOVE_ACCESSORY'; accessoryId: string }
  | {
      type: 'SET_ACCESSORY_POSITION';
      accessoryId: string;
      cogXMm: number;
      cogYMm: number;
    }
  | {
      type: 'SET_CARAVAN_ACCESSORY_POSITION';
      accessoryId: string;
      cogXMm: number;
      cogYMm: number;
    }
  | { type: 'ADD_CARAVAN_ACCESSORY'; accessory: AccessorySelection }
  | { type: 'REMOVE_CARAVAN_ACCESSORY'; accessoryId: string }
  | { type: 'SET_ACCESSORY_HEIGHT'; accessoryId: string; cogZMm: number }
  | { type: 'SET_ACCESSORY_LOCK'; accessoryId: string; unlocked: boolean }
  | { type: 'ADD_CUSTOM_LOAD'; load: CustomLoad }
  | { type: 'REMOVE_CUSTOM_LOAD'; id: string }
  | {
      type: 'SET_CUSTOM_LOAD_POSITION';
      id: string;
      cogXMm: number;
      cogYMm: number;
    }
  | { type: 'SET_CUSTOM_LOAD_HEIGHT'; id: string; cogZMm: number }
  | { type: 'SET_CALIBRATION'; calibration: CalibrationState }
  | { type: 'CLEAR_CALIBRATION' }
  | { type: 'SET_PLATE_CONFIRMED'; plate: PlateConfirmedLimits }
  | { type: 'CLEAR_PLATE_CONFIRMED' }
  | { type: 'LOAD_STATE'; state: CalculatorState }
  | { type: 'RESET' };

export const DEFAULT_JOURNEY: JourneyAssumptions = {
  passengers: 2,
  passengerWeightKg: 80,
  cargoKg: 0,
  fuelPercent: 100,
  freshWaterPercent: 100,
  greyWaterPercent: 0,
  gearKg: 0,
};

export const DEFAULT_CARAVAN_ASSUMPTIONS: CaravanAssumptions = {
  freshWaterL: 0,
  greyWaterL: 0,
  gearKg: 0,
};

export const INITIAL_STATE: CalculatorState = {
  vehicleVariantId: null,
  caravanVariantId: null,
  journey: DEFAULT_JOURNEY,
  caravanAssumptions: DEFAULT_CARAVAN_ASSUMPTIONS,
  accessories: [],
  caravanAccessories: [],
  customLoads: [],
  calibration: null,
  plateConfirmed: null,
};

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case 'SET_VEHICLE_VARIANT':
      // A different vehicle invalidates any plate confirmation for the old one.
      if (action.id === null) {
        return {
          ...state,
          vehicleVariantId: null,
          accessories: [],
          plateConfirmed: null,
        };
      }
      return {
        ...state,
        vehicleVariantId: action.id,
        plateConfirmed:
          action.id === state.vehicleVariantId ? state.plateConfirmed : null,
      };
    case 'SET_CARAVAN_VARIANT':
      if (action.id === null) {
        return { ...state, caravanVariantId: null, caravanAccessories: [] };
      }
      return { ...state, caravanVariantId: action.id };
    case 'SET_JOURNEY':
      return { ...state, journey: { ...state.journey, ...action.patch } };
    case 'SET_CARAVAN_ASSUMPTIONS':
      return {
        ...state,
        caravanAssumptions: { ...state.caravanAssumptions, ...action.patch },
      };
    case 'ADD_ACCESSORY':
      if (
        state.accessories.some(
          (a) => a.accessoryId === action.accessory.accessoryId,
        )
      ) {
        return state;
      }
      return {
        ...state,
        accessories: [...state.accessories, action.accessory],
      };
    case 'REMOVE_ACCESSORY':
      return {
        ...state,
        accessories: state.accessories.filter(
          (a) => a.accessoryId !== action.accessoryId,
        ),
      };
    case 'SET_ACCESSORY_POSITION':
      return {
        ...state,
        accessories: state.accessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, cogXMm: action.cogXMm, cogYMm: action.cogYMm }
            : a,
        ),
      };
    case 'SET_CARAVAN_ACCESSORY_POSITION':
      return {
        ...state,
        caravanAccessories: state.caravanAccessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, cogXMm: action.cogXMm, cogYMm: action.cogYMm }
            : a,
        ),
      };
    case 'SET_ACCESSORY_HEIGHT':
      // Applies to whichever side holds the accessory (vehicle or caravan).
      return {
        ...state,
        accessories: state.accessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, cogZMm: action.cogZMm }
            : a,
        ),
        caravanAccessories: state.caravanAccessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, cogZMm: action.cogZMm }
            : a,
        ),
      };
    case 'SET_ACCESSORY_LOCK':
      return {
        ...state,
        accessories: state.accessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, positionUnlocked: action.unlocked }
            : a,
        ),
        caravanAccessories: state.caravanAccessories.map((a) =>
          a.accessoryId === action.accessoryId
            ? { ...a, positionUnlocked: action.unlocked }
            : a,
        ),
      };
    case 'ADD_CARAVAN_ACCESSORY':
      if (
        state.caravanAccessories.some(
          (a) => a.accessoryId === action.accessory.accessoryId,
        )
      ) {
        return state;
      }
      return {
        ...state,
        caravanAccessories: [...state.caravanAccessories, action.accessory],
      };
    case 'REMOVE_CARAVAN_ACCESSORY':
      return {
        ...state,
        caravanAccessories: state.caravanAccessories.filter(
          (a) => a.accessoryId !== action.accessoryId,
        ),
      };
    case 'ADD_CUSTOM_LOAD':
      return { ...state, customLoads: [...state.customLoads, action.load] };
    case 'REMOVE_CUSTOM_LOAD':
      return {
        ...state,
        customLoads: state.customLoads.filter((l) => l.id !== action.id),
      };
    case 'SET_CUSTOM_LOAD_HEIGHT':
      return {
        ...state,
        customLoads: state.customLoads.map((l) =>
          l.id === action.id ? { ...l, cogZMm: action.cogZMm } : l,
        ),
      };
    case 'SET_CUSTOM_LOAD_POSITION':
      return {
        ...state,
        customLoads: state.customLoads.map((l) =>
          l.id === action.id
            ? { ...l, cogXMm: action.cogXMm, cogYMm: action.cogYMm }
            : l,
        ),
      };
    case 'SET_CALIBRATION':
      return { ...state, calibration: action.calibration };
    case 'CLEAR_CALIBRATION': {
      const unaccountedId = state.calibration?.unaccountedLoadId;
      return {
        ...state,
        calibration: null,
        // also drop the positioned unaccounted load it created
        customLoads: unaccountedId
          ? state.customLoads.filter((l) => l.id !== unaccountedId)
          : state.customLoads,
      };
    }
    case 'SET_PLATE_CONFIRMED':
      return { ...state, plateConfirmed: action.plate };
    case 'CLEAR_PLATE_CONFIRMED':
      return { ...state, plateConfirmed: null };
    case 'LOAD_STATE':
      // Full-state hydration from a saved DB setup (carries customLoads +
      // calibration, which the URL round-trip drops). Spread over the defaults
      // so any missing field is well-formed. Reused by P2 version revert.
      return { ...INITIAL_STATE, ...action.state };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}
