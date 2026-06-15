'use client';

import { Suspense, useMemo } from 'react';
import { CalculatorProvider } from '@/modules/calculator/context';
import { LayoutEditorInner } from './LayoutEditorInner';

export function LayoutEditor({
  vehicleVariantId,
  vehicleName,
  caravanVariantId,
}: {
  vehicleVariantId: string;
  vehicleName: string;
  caravanVariantId: string | null;
}) {
  // Seed the calculator state from the route. The provider then drives all the
  // physics, persistence, and accessory search — the editor is just a richer
  // surface over the same engine the calculator uses.
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('vehicleVariantId', vehicleVariantId);
    if (caravanVariantId) p.set('caravanVariantId', caravanVariantId);
    return p;
  }, [vehicleVariantId, caravanVariantId]);

  return (
    <Suspense>
      <CalculatorProvider initialParams={params}>
        <LayoutEditorInner vehicleName={vehicleName} />
      </CalculatorProvider>
    </Suspense>
  );
}
