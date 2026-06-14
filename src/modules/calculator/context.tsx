'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CalculatorState,
  CalculatorAction,
  JourneyAssumptions,
  CaravanAssumptions,
  AccessorySelection,
} from './types';
import { calculatorReducer, INITIAL_STATE } from './types';
import { paramsToState, stateToParams } from './url-params';

interface CalculatorContextValue {
  state: CalculatorState;
  setVehicleVariant: (id: string | null) => void;
  setCaravanVariant: (id: string | null) => void;
  setJourney: (patch: Partial<JourneyAssumptions>) => void;
  setCaravanAssumptions: (patch: Partial<CaravanAssumptions>) => void;
  addAccessory: (accessory: AccessorySelection) => void;
  removeAccessory: (accessoryId: string) => void;
  addCaravanAccessory: (accessory: AccessorySelection) => void;
  removeCaravanAccessory: (accessoryId: string) => void;
  reset: () => void;
  dispatch: (action: CalculatorAction) => void;
}

const CalculatorContext = createContext<CalculatorContextValue | null>(null);

export function useCalculatorState(): CalculatorContextValue {
  const ctx = useContext(CalculatorContext);
  if (!ctx) {
    throw new Error(
      'useCalculatorState must be used within CalculatorProvider',
    );
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

  // Capture the inbound URL once, synchronously, before the state→URL sync
  // effect below can rewrite it. SEO page CTAs use the spec §9.5 contract
  // (/calculator?v={vehicle-slug}&c={caravan-slug}&p={passengers}&fuel={pct}),
  // which uses readable slugs rather than the internal variant IDs.
  const inboundRef = useRef<URLSearchParams | null>(null);
  if (inboundRef.current === null) {
    inboundRef.current = new URLSearchParams(
      (initialParams ?? searchParams).toString(),
    );
  }
  const resolvedRef = useRef(false);

  // Resolve the spec §9.5 inbound slug contract into calculator state (once).
  useEffect(() => {
    if (resolvedRef.current) return;
    const sp = inboundRef.current!;
    const v = sp.get('v');
    const c = sp.get('c');
    const p = sp.get('p');
    const fuel = sp.get('fuel');
    if (!v && !c && p == null && fuel == null) return;
    resolvedRef.current = true;

    // Journey params resolve synchronously.
    const patch: Partial<JourneyAssumptions> = {};
    const pn = p != null ? parseInt(p, 10) : NaN;
    if (!isNaN(pn)) patch.passengers = Math.min(9, Math.max(1, pn));
    const fn = fuel != null ? parseInt(fuel, 10) : NaN;
    if (!isNaN(fn)) patch.fuelPercent = Math.min(100, Math.max(0, fn));
    if (Object.keys(patch).length) dispatch({ type: 'SET_JOURNEY', patch });

    // Vehicle/caravan slugs need an async lookup to their variant IDs.
    if (v || c) {
      const q = new URLSearchParams();
      if (v) q.set('v', v);
      if (c) q.set('c', c);
      let active = true;
      fetch(`/api/calculator/resolve?${q.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (!active || !res) return;
          if (res.vehicleVariantId)
            dispatch({ type: 'SET_VEHICLE_VARIANT', id: res.vehicleVariantId });
          if (res.caravanVariantId)
            dispatch({ type: 'SET_CARAVAN_VARIANT', id: res.caravanVariantId });
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = stateToParams(state);
    // Preserve setupId across calculator state updates
    const setupId = searchParams.get('setupId');
    if (setupId) params.set('setupId', setupId);
    const qs = params.toString();
    const current = searchParams.toString();
    if (qs !== current) {
      router.replace(`?${qs}`, { scroll: false });
    }
  }, [state, router, searchParams]);

  const setVehicleVariant = useCallback(
    (id: string | null) => dispatch({ type: 'SET_VEHICLE_VARIANT', id }),
    [],
  );
  const setCaravanVariant = useCallback(
    (id: string | null) => dispatch({ type: 'SET_CARAVAN_VARIANT', id }),
    [],
  );
  const setJourney = useCallback(
    (patch: Partial<JourneyAssumptions>) =>
      dispatch({ type: 'SET_JOURNEY', patch }),
    [],
  );
  const setCaravanAssumptions = useCallback(
    (patch: Partial<CaravanAssumptions>) =>
      dispatch({ type: 'SET_CARAVAN_ASSUMPTIONS', patch }),
    [],
  );
  const addAccessory = useCallback(
    (accessory: AccessorySelection) =>
      dispatch({ type: 'ADD_ACCESSORY', accessory }),
    [],
  );
  const removeAccessory = useCallback(
    (accessoryId: string) =>
      dispatch({ type: 'REMOVE_ACCESSORY', accessoryId }),
    [],
  );
  const addCaravanAccessory = useCallback(
    (accessory: AccessorySelection) =>
      dispatch({ type: 'ADD_CARAVAN_ACCESSORY', accessory }),
    [],
  );
  const removeCaravanAccessory = useCallback(
    (accessoryId: string) =>
      dispatch({ type: 'REMOVE_CARAVAN_ACCESSORY', accessoryId }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return (
    <CalculatorContext
      value={{
        state,
        setVehicleVariant,
        setCaravanVariant,
        setJourney,
        setCaravanAssumptions,
        addAccessory,
        removeAccessory,
        addCaravanAccessory,
        removeCaravanAccessory,
        reset,
        dispatch,
      }}
    >
      {children}
    </CalculatorContext>
  );
}
