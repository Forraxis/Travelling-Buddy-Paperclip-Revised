'use client';

// Simple vs Advanced disclosure mode. As the calculator grew (positioning, 3D,
// stability, calibration, versions), most users still just want the legal/axle
// verdict — so Simple is the default and Advanced is opt-in, remembered per
// device. Components gate optional panels on `mode`.
import { createContext, useContext, useEffect, useState } from 'react';

export type CalcMode = 'simple' | 'advanced';

const STORAGE_KEY = 'tb:calc-mode';

interface CalcModeValue {
  mode: CalcMode;
  setMode: (m: CalcMode) => void;
}

const CalcModeContext = createContext<CalcModeValue | null>(null);

export function CalcModeProvider({ children }: { children: React.ReactNode }) {
  // Default Simple; hydrate the remembered choice on the client (avoids an SSR
  // mismatch — server always renders Simple, then we sync).
  const [mode, setModeState] = useState<CalcMode>('simple');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'advanced' || saved === 'simple') setModeState(saved);
    } catch {
      // localStorage unavailable (private mode) — stay on the default.
    }
  }, []);

  const setMode = (m: CalcMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  };

  return (
    <CalcModeContext value={{ mode, setMode }}>{children}</CalcModeContext>
  );
}

/**
 * Read the disclosure mode. Outside a provider (e.g. the standalone layout
 * planner, which is inherently advanced) it falls back to 'advanced' so nothing
 * is hidden.
 */
export function useCalcMode(): CalcModeValue {
  return useContext(CalcModeContext) ?? { mode: 'advanced', setMode: () => {} };
}
