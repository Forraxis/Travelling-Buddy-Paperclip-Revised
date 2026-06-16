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
  CustomLoad,
} from './types';
import { calculatorReducer } from './types';
import { paramsToState, stateToParams } from './url-params';
import { setupToCalculatorState } from './setup-to-state';
import { popLayoutHandoff } from '@/lib/layout-handoff';

interface CalculatorContextValue {
  state: CalculatorState;
  setVehicleVariant: (id: string | null) => void;
  setCaravanVariant: (id: string | null) => void;
  setJourney: (patch: Partial<JourneyAssumptions>) => void;
  setCaravanAssumptions: (patch: Partial<CaravanAssumptions>) => void;
  addAccessory: (accessory: AccessorySelection) => void;
  removeAccessory: (accessoryId: string) => void;
  setAccessoryPosition: (
    accessoryId: string,
    cogXMm: number,
    cogYMm: number,
  ) => void;
  setCaravanAccessoryPosition: (
    accessoryId: string,
    cogXMm: number,
    cogYMm: number,
  ) => void;
  addCaravanAccessory: (accessory: AccessorySelection) => void;
  removeCaravanAccessory: (accessoryId: string) => void;
  addCustomLoad: (load: CustomLoad) => void;
  removeCustomLoad: (id: string) => void;
  setCustomLoadPosition: (id: string, cogXMm: number, cogYMm: number) => void;
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
    const a = sp.get('a');
    const p = sp.get('p');
    const fuel = sp.get('fuel');
    if (!v && !c && !a && p == null && fuel == null) return;
    resolvedRef.current = true;

    // Journey params resolve synchronously.
    const patch: Partial<JourneyAssumptions> = {};
    const pn = p != null ? parseInt(p, 10) : NaN;
    if (!isNaN(pn)) patch.passengers = Math.min(9, Math.max(1, pn));
    const fn = fuel != null ? parseInt(fuel, 10) : NaN;
    if (!isNaN(fn)) patch.fuelPercent = Math.min(100, Math.max(0, fn));
    if (Object.keys(patch).length) dispatch({ type: 'SET_JOURNEY', patch });

    // Vehicle/caravan slugs (and accessory slugs, resolved against the vehicle)
    // need an async lookup to their variant IDs / fitments.
    if (v || c || a) {
      const q = new URLSearchParams();
      if (v) q.set('v', v);
      if (c) q.set('c', c);
      if (a) q.set('a', a);
      let active = true;
      fetch(`/api/calculator/resolve?${q.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (!active || !res) return;
          if (res.vehicleVariantId)
            dispatch({ type: 'SET_VEHICLE_VARIANT', id: res.vehicleVariantId });
          if (res.caravanVariantId)
            dispatch({ type: 'SET_CARAVAN_VARIANT', id: res.caravanVariantId });
          if (Array.isArray(res.accessories)) {
            for (const acc of res.accessories) {
              dispatch({ type: 'ADD_ACCESSORY', accessory: acc });
            }
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, []);

  // Hydrate full state on mount (custom loads + calibration + drag positions,
  // which the URL round-trip drops). Runs once. A sessionStorage hand-off (the
  // live rig carried from the calculator's "Customise layout") takes precedence
  // over the saved-setup fetch — it IS the latest state, including unsaved edits.
  // `?setupId=` stays in the URL either way, so save-back/versions still target
  // the right setup.
  const setupLoadedRef = useRef(false);
  useEffect(() => {
    if (setupLoadedRef.current) return;
    setupLoadedRef.current = true;

    const handoff = popLayoutHandoff();
    if (handoff) {
      dispatch({ type: 'LOAD_STATE', state: handoff });
      return;
    }

    const setupId = (initialParams ?? searchParams).get('setupId');
    if (!setupId) return;
    let active = true;
    fetch(`/api/setups/${setupId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((setup) => {
        if (!active || !setup) return;
        dispatch({ type: 'LOAD_STATE', state: setupToCalculatorState(setup) });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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
  const setAccessoryPosition = useCallback(
    (accessoryId: string, cogXMm: number, cogYMm: number) =>
      dispatch({ type: 'SET_ACCESSORY_POSITION', accessoryId, cogXMm, cogYMm }),
    [],
  );
  const setCaravanAccessoryPosition = useCallback(
    (accessoryId: string, cogXMm: number, cogYMm: number) =>
      dispatch({
        type: 'SET_CARAVAN_ACCESSORY_POSITION',
        accessoryId,
        cogXMm,
        cogYMm,
      }),
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
  const addCustomLoad = useCallback(
    (load: CustomLoad) => dispatch({ type: 'ADD_CUSTOM_LOAD', load }),
    [],
  );
  const removeCustomLoad = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_CUSTOM_LOAD', id }),
    [],
  );
  const setCustomLoadPosition = useCallback(
    (id: string, cogXMm: number, cogYMm: number) =>
      dispatch({ type: 'SET_CUSTOM_LOAD_POSITION', id, cogXMm, cogYMm }),
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
        setAccessoryPosition,
        setCaravanAccessoryPosition,
        addCaravanAccessory,
        removeCaravanAccessory,
        addCustomLoad,
        removeCustomLoad,
        setCustomLoadPosition,
        reset,
        dispatch,
      }}
    >
      {children}
    </CalculatorContext>
  );
}
