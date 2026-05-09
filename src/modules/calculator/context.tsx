"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CalculatorState, CalculatorAction, JourneyAssumptions, SelectedAccessory } from "./types";
import { calculatorReducer, INITIAL_STATE } from "./types";
import { paramsToState, stateToParams } from "./url-params";

interface CalculatorContextValue {
  state: CalculatorState;
  setVehicleVariant: (id: string | null) => void;
  setCaravanVariant: (id: string | null) => void;
  setJourney: (patch: Partial<JourneyAssumptions>) => void;
  addAccessory: (accessory: SelectedAccessory) => void;
  removeAccessory: (fitmentId: string) => void;
  updateAccessory: (fitmentId: string, patch: Partial<Omit<SelectedAccessory, "fitmentId">>) => void;
  reset: () => void;
  dispatch: (action: CalculatorAction) => void;
}

const CalculatorContext = createContext<CalculatorContextValue | null>(null);

export function useCalculatorState(): CalculatorContextValue {
  const ctx = useContext(CalculatorContext);
  if (!ctx) {
    throw new Error("useCalculatorState must be used within CalculatorProvider");
  }
  return ctx;
}

interface ProviderProps {
  children: React.ReactNode;
  initialParams?: URLSearchParams;
}

export function CalculatorProvider({ children, initialParams }: ProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, dispatch] = useReducer(
    calculatorReducer,
    initialParams ?? searchParams,
    paramsToState,
  );

  useEffect(() => {
    const params = stateToParams(state);
    const qs = params.toString();
    const current = searchParams.toString();
    if (qs !== current) {
      router.replace(`?${qs}`, { scroll: false });
    }
  }, [state, router, searchParams]);

  const setVehicleVariant = useCallback(
    (id: string | null) => dispatch({ type: "SET_VEHICLE_VARIANT", id }),
    [],
  );
  const setCaravanVariant = useCallback(
    (id: string | null) => dispatch({ type: "SET_CARAVAN_VARIANT", id }),
    [],
  );
  const setJourney = useCallback(
    (patch: Partial<JourneyAssumptions>) => dispatch({ type: "SET_JOURNEY", patch }),
    [],
  );
  const addAccessory = useCallback(
    (accessory: SelectedAccessory) => dispatch({ type: "ADD_ACCESSORY", accessory }),
    [],
  );
  const removeAccessory = useCallback(
    (fitmentId: string) => dispatch({ type: "REMOVE_ACCESSORY", fitmentId }),
    [],
  );
  const updateAccessory = useCallback(
    (fitmentId: string, patch: Partial<Omit<SelectedAccessory, "fitmentId">>) =>
      dispatch({ type: "UPDATE_ACCESSORY", fitmentId, patch }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <CalculatorContext
      value={{
        state,
        setVehicleVariant,
        setCaravanVariant,
        setJourney,
        addAccessory,
        removeAccessory,
        updateAccessory,
        reset,
        dispatch,
      }}
    >
      {children}
    </CalculatorContext>
  );
}
