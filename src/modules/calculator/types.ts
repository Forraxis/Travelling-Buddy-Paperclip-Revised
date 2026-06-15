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
  /** User-positioned longitudinal CoG (mm from rear axle). Overrides template. */
  cogXMm?: number | null;
  /** User-positioned lateral CoG (mm from centreline, + = right). */
  cogYMm?: number | null;
}

/** A user-made load (not a catalogue accessory) placed in the layout editor. */
export interface CustomLoad {
  id: string;
  label: string;
  massKg: number;
  side: 'vehicle' | 'caravan';
  cogXMm?: number | null;
  cogYMm?: number | null;
  footprintLengthMm?: number | null;
  footprintWidthMm?: number | null;
}

export interface CalculatorState {
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
  journey: JourneyAssumptions;
  caravanAssumptions: CaravanAssumptions;
  accessories: AccessorySelection[];
  caravanAccessories: AccessorySelection[];
  customLoads: CustomLoad[];
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
  | { type: 'ADD_CUSTOM_LOAD'; load: CustomLoad }
  | { type: 'REMOVE_CUSTOM_LOAD'; id: string }
  | {
      type: 'SET_CUSTOM_LOAD_POSITION';
      id: string;
      cogXMm: number;
      cogYMm: number;
    }
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
};

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case 'SET_VEHICLE_VARIANT':
      if (action.id === null) {
        return { ...state, vehicleVariantId: null, accessories: [] };
      }
      return { ...state, vehicleVariantId: action.id };
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
    case 'SET_CUSTOM_LOAD_POSITION':
      return {
        ...state,
        customLoads: state.customLoads.map((l) =>
          l.id === action.id
            ? { ...l, cogXMm: action.cogXMm, cogYMm: action.cogYMm }
            : l,
        ),
      };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}
