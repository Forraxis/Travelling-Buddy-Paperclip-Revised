'use client';

import { useCalculatorState } from '@/modules/calculator/context';
import { MobileResultsBar } from './MobileResultsBar';

export function MobileResultsBarWrapper() {
  const { state } = useCalculatorState();
  return <MobileResultsBar vehicleSelected={state.vehicleVariantId !== null} />;
}
