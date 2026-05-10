'use client';

import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsResult } from '@/modules/calculator/use-physics-result';
import { MobileResultsBar } from './MobileResultsBar';

export function MobileResultsBarWrapper() {
  const { state } = useCalculatorState();
  const result = usePhysicsResult();
  return (
    <MobileResultsBar
      vehicleSelected={state.vehicleVariantId !== null}
      result={result}
    />
  );
}
