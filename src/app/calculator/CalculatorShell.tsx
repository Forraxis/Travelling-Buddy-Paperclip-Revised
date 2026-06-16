'use client';

import { Suspense } from 'react';
import { CalculatorProvider } from '@/modules/calculator/context';
import { CalcModeProvider } from '@/modules/calculator/calc-mode';

export function CalculatorShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <CalcModeProvider>
        <CalculatorProvider>{children}</CalculatorProvider>
      </CalcModeProvider>
    </Suspense>
  );
}
