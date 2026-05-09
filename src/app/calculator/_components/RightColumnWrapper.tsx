'use client';

import { useCalculatorState } from '@/modules/calculator/context';
import RightColumn from './RightColumn';

export function RightColumnWrapper() {
  const { state } = useCalculatorState();
  return <RightColumn vehicleSelected={state.vehicleVariantId !== null} />;
}
