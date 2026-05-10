'use client';

import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsResult } from '@/modules/calculator/use-physics-result';
import RightColumn from './RightColumn';

export function RightColumnWrapper() {
  const { state } = useCalculatorState();
  const result = usePhysicsResult();
  return (
    <RightColumn
      vehicleSelected={state.vehicleVariantId !== null}
      result={result}
    />
  );
}
