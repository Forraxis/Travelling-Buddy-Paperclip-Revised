"use client";

import { Suspense } from "react";
import { CalculatorProvider } from "@/modules/calculator/context";

export function CalculatorShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <CalculatorProvider>{children}</CalculatorProvider>
    </Suspense>
  );
}
