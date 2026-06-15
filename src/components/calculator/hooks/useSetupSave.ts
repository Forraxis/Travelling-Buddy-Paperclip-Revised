'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useCalculatorState } from '@/modules/calculator/context';
import { saveLocalSetup } from '@/lib/local-setups';
import { generateSetupName } from '@/lib/setup-name';

interface SaveOptions {
  vehicleName?: { name: string; model: { name: string } } | null;
  caravanName?: { name: string; model: { name: string } } | null;
}

interface SaveResult {
  ok: boolean;
  id?: string;
  shareToken?: string;
  isAnonymous?: boolean;
}

export function useSetupSave(
  setupId: string | null,
  options: SaveOptions = {},
) {
  const { data: session } = useSession();
  const { state } = useCalculatorState();
  const [saving, setSaving] = useState(false);

  const buildPayload = useCallback(
    () => ({
      vehicleVariantId: state.vehicleVariantId ?? undefined,
      caravanVariantId: state.caravanVariantId ?? undefined,
      passengers: state.journey.passengers,
      cargoKg: state.journey.cargoKg,
      fuelPercent: state.journey.fuelPercent,
      freshWaterPercent: state.journey.freshWaterPercent,
      greyWaterPercent: state.journey.greyWaterPercent,
      accessories: state.accessories.map((a) => ({
        fitmentId: a.accessoryId,
        quantityOverride: 1,
        fillPercent: 100,
        ...(a.cogXMm != null ? { cogXMm: a.cogXMm } : {}),
        ...(a.cogYMm != null ? { cogYMm: a.cogYMm } : {}),
      })),
      caravanAccessories: state.caravanAccessories.map((a) => ({
        fitmentId: a.accessoryId,
        quantityOverride: 1,
        fillPercent: 100,
        ...(a.cogXMm != null ? { cogXMm: a.cogXMm } : {}),
        ...(a.cogYMm != null ? { cogYMm: a.cogYMm } : {}),
      })),
      customLoads: state.customLoads.map((l) => ({
        label: l.label,
        weightKg: l.massKg,
        mountingLocation:
          l.side === 'caravan' ? 'CARAVAN_CHASSIS_MID' : 'CHASSIS_MID',
        side: l.side === 'caravan' ? 'CARAVAN' : 'VEHICLE',
        ...(l.cogXMm != null ? { cogXMm: l.cogXMm } : {}),
        ...(l.cogYMm != null ? { cogYMm: l.cogYMm } : {}),
        ...(l.footprintLengthMm != null
          ? { footprintLengthMm: l.footprintLengthMm }
          : {}),
        ...(l.footprintWidthMm != null
          ? { footprintWidthMm: l.footprintWidthMm }
          : {}),
      })),
    }),
    [state],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    if (!state.vehicleVariantId) return { ok: false };
    setSaving(true);
    try {
      if (session?.user) {
        if (setupId) {
          const res = await fetch(`/api/setups/${setupId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload()),
          });
          if (!res.ok) return { ok: false };
          return { ok: true, id: setupId };
        } else {
          const res = await fetch('/api/setups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload()),
          });
          if (!res.ok) return { ok: false };
          const data = await res.json();
          return { ok: true, id: data.id, shareToken: data.shareToken };
        }
      } else {
        const name = options.vehicleName
          ? generateSetupName(options.vehicleName, options.caravanName ?? null)
          : `Setup ${new Date().toLocaleDateString()}`;
        const rigIdentifier = options.vehicleName
          ? `${options.vehicleName.model.name} ${options.vehicleName.name}`
          : 'Unknown vehicle';
        saveLocalSetup(name, rigIdentifier, state);
        return { ok: true, isAnonymous: true };
      }
    } catch {
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [
    session,
    state,
    setupId,
    buildPayload,
    options.vehicleName,
    options.caravanName,
  ]);

  return { save, saving, canSave: !!state.vehicleVariantId };
}
