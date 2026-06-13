'use client';

import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';
import RightColumn from './RightColumn';

export function RightColumnWrapper() {
  const { state } = useCalculatorState();
  const view = usePhysicsView();
  return (
    <RightColumn
      vehicleSelected={state.vehicleVariantId !== null}
      result={view?.result ?? null}
      schematic={view?.schematic ?? null}
    />
  );
}
