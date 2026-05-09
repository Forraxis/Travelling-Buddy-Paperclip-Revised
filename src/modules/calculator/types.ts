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

export interface SelectedAccessory {
  fitmentId: string;
  quantity: number;
  fillPercent: number;
}

export interface CalculatorState {
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
  journey: JourneyAssumptions;
  caravanAssumptions: CaravanAssumptions;
  accessories: SelectedAccessory[];
}

export type CalculatorAction =
  | { type: "SET_VEHICLE_VARIANT"; id: string | null }
  | { type: "SET_CARAVAN_VARIANT"; id: string | null }
  | { type: "SET_JOURNEY"; patch: Partial<JourneyAssumptions> }
  | { type: "SET_CARAVAN_ASSUMPTIONS"; patch: Partial<CaravanAssumptions> }
  | { type: "ADD_ACCESSORY"; accessory: SelectedAccessory }
  | { type: "REMOVE_ACCESSORY"; fitmentId: string }
  | { type: "UPDATE_ACCESSORY"; fitmentId: string; patch: Partial<Omit<SelectedAccessory, "fitmentId">> }
  | { type: "RESET" };

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
};

export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case "SET_VEHICLE_VARIANT":
      return { ...state, vehicleVariantId: action.id };
    case "SET_CARAVAN_VARIANT":
      return { ...state, caravanVariantId: action.id };
    case "SET_JOURNEY":
      return { ...state, journey: { ...state.journey, ...action.patch } };
    case "SET_CARAVAN_ASSUMPTIONS":
      return { ...state, caravanAssumptions: { ...state.caravanAssumptions, ...action.patch } };
    case "ADD_ACCESSORY":
      if (state.accessories.some((a) => a.fitmentId === action.accessory.fitmentId)) {
        return state;
      }
      return { ...state, accessories: [...state.accessories, action.accessory] };
    case "REMOVE_ACCESSORY":
      return {
        ...state,
        accessories: state.accessories.filter((a) => a.fitmentId !== action.fitmentId),
      };
    case "UPDATE_ACCESSORY":
      return {
        ...state,
        accessories: state.accessories.map((a) =>
          a.fitmentId === action.fitmentId ? { ...a, ...action.patch } : a,
        ),
      };
    case "RESET":
      return INITIAL_STATE;
    default:
      return state;
  }
}
