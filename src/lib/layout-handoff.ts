// One-shot, same-origin hand-off of the live calculator state to the full-screen
// layout planner. The calculator URL can't carry everything (accessory drag
// positions round-trip, but custom loads + weighbridge calibration don't), so
// when the user clicks "Customise layout" we stash the exact CalculatorState in
// sessionStorage and the planner consumes it once on mount. Survives the client
// navigation; cleared on read so it never leaks into a later session.
import type { CalculatorState } from '@/modules/calculator/types';

const KEY = 'tb:layout-handoff';

export function stashLayoutHandoff(state: CalculatorState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // sessionStorage can throw (private mode / quota) — non-fatal; the planner
    // just falls back to seeding from the URL.
  }
}

/** Read and remove the hand-off, if any. */
export function popLayoutHandoff(): CalculatorState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as CalculatorState;
  } catch {
    return null;
  }
}
