'use client';

import { Suspense, useMemo } from 'react';
import { CalculatorProvider } from '@/modules/calculator/context';
import { LayoutEditorInner } from './LayoutEditorInner';

export function LayoutEditor({
  vehicleVariantId,
  vehicleName,
  caravanVariantId,
  setupId,
}: {
  vehicleVariantId: string;
  vehicleName: string;
  caravanVariantId: string | null;
  setupId?: string | null;
}) {
  // Seed the calculator state from the route. The provider then drives all the
  // physics, persistence, and accessory search — the editor is just a richer
  // surface over the same engine the calculator uses. When `setupId` is present,
  // it's seeded here so the provider's setup-loader hydrates the full saved state
  // (custom loads + the owner's weighbridge calibration), same as the calculator.
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('vehicleVariantId', vehicleVariantId);
    if (caravanVariantId) p.set('caravanVariantId', caravanVariantId);
    if (setupId) p.set('setupId', setupId);
    return p;
  }, [vehicleVariantId, caravanVariantId, setupId]);

  return (
    <Suspense>
      <CalculatorProvider initialParams={params}>
        <LayoutEditorInner vehicleName={vehicleName} setupId={setupId ?? null} />
      </CalculatorProvider>
    </Suspense>
  );
}
