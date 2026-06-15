'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';
import { useSetupSave } from '@/components/calculator/hooks/useSetupSave';
import { AccessoryPicker } from '@/components/calculator/accessory-picker';
import type { AccessoryItem } from '@/components/calculator/accessory-picker';
import CoupledRigCanvas from '@/components/schematic/CoupledRigCanvas';

type Side = 'vehicle' | 'caravan';

export function LayoutEditorInner({ vehicleName }: { vehicleName: string }) {
  const {
    state,
    addAccessory,
    removeAccessory,
    addCaravanAccessory,
    removeCaravanAccessory,
    setAccessoryPosition,
    setCaravanAccessoryPosition,
  } = useCalculatorState();
  const view = usePhysicsView();
  const { save, saving } = useSetupSave(null, {
    vehicleName: { name: vehicleName, model: { name: vehicleName } },
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [contribMsg, setContribMsg] = useState<string | null>(null);

  const addVehicle = useCallback(
    (item: AccessoryItem) =>
      addAccessory({
        accessoryId: item.fitmentId,
        massKg: item.installedWeightKg,
        mountingLocation: item.mountingLocation,
        cogXMm: item.cogXMm,
        cogYMm: item.cogYMm,
      }),
    [addAccessory],
  );
  const addCaravan = useCallback(
    (item: AccessoryItem) =>
      addCaravanAccessory({
        accessoryId: item.fitmentId,
        massKg: item.installedWeightKg,
        mountingLocation: item.mountingLocation,
        cogXMm: item.cogXMm,
        cogYMm: item.cogYMm,
      }),
    [addCaravanAccessory],
  );

  const onMove = useCallback(
    (side: Side, id: string, x: number, y: number) =>
      side === 'vehicle'
        ? setAccessoryPosition(id, x, y)
        : setCaravanAccessoryPosition(id, x, y),
    [setAccessoryPosition, setCaravanAccessoryPosition],
  );
  const onRemove = useCallback(
    (side: Side, id: string) =>
      side === 'vehicle' ? removeAccessory(id) : removeCaravanAccessory(id),
    [removeAccessory, removeCaravanAccessory],
  );

  async function handleSave() {
    setSavedMsg(null);
    const res = await save();
    setSavedMsg(res.ok ? 'Saved — open it from the calculator any time.' : 'Save failed.');
  }

  async function handleContribute() {
    setContribMsg(null);
    const vehItems = state.accessories.filter((a) => a.cogXMm != null && a.cogYMm != null);
    const calls: Promise<Response>[] = [];
    if (state.vehicleVariantId && vehItems.length) {
      calls.push(
        fetch('/api/fitments/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleVariantId: state.vehicleVariantId,
            source: 'layout-editor',
            items: vehItems.map((a) => ({ fitmentId: a.accessoryId, cogXMm: Math.round(a.cogXMm!), cogYMm: Math.round(a.cogYMm!) })),
          }),
        }),
      );
    }
    const vanItems = state.caravanAccessories.filter((a) => a.cogXMm != null && a.cogYMm != null);
    if (state.caravanVariantId && vanItems.length) {
      calls.push(
        fetch('/api/fitments/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caravanVariantId: state.caravanVariantId,
            source: 'layout-editor',
            items: vanItems.map((a) => ({ fitmentId: a.accessoryId, cogXMm: Math.round(a.cogXMm!), cogYMm: Math.round(a.cogYMm!) })),
          }),
        }),
      );
    }
    if (!calls.length) {
      setContribMsg('Position something first, then share it.');
      return;
    }
    const results = await Promise.all(calls);
    setContribMsg(results.every((r) => r.ok) ? 'Thanks! Submitted for review.' : 'Some items could not be submitted.');
  }

  const hasPositions =
    state.accessories.some((a) => a.cogXMm != null) ||
    state.caravanAccessories.some((a) => a.cogXMm != null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="order-2 lg:order-1">
        {view ? (
          <CoupledRigCanvas
            model={view.schematic!}
            result={view.result}
            onMove={onMove}
            onRemove={onRemove}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-tb-neutral-200 text-sm text-gray-400">
            Loading your rig…
          </div>
        )}
      </div>

      <aside className="order-1 space-y-4 lg:order-2">
        <div className="rounded-2xl border border-tb-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-tb-ink">Vehicle accessories</h2>
          <p className="mb-2 text-xs text-gray-500">Add gear, then drag it into place.</p>
          <AccessoryPicker
            onAdd={addVehicle}
            onRemove={removeAccessory}
            addedFitmentIds={state.accessories.map((a) => a.accessoryId)}
            context="vehicle"
          />
        </div>

        {state.caravanVariantId ? (
          <div className="rounded-2xl border border-tb-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-tb-ink">Caravan accessories</h2>
            <p className="mb-2 text-xs text-gray-500">Mounted gear moves the tow-ball.</p>
            <AccessoryPicker
              onAdd={addCaravan}
              onRemove={removeCaravanAccessory}
              addedFitmentIds={state.caravanAccessories.map((a) => a.accessoryId)}
              context="caravan"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-tb-neutral-200 bg-white/60 p-4 text-xs text-gray-500">
            Towing? Open this rig with a caravan attached from the{' '}
            <Link href="/calculator/" className="font-medium text-tb-primary underline">calculator</Link>{' '}
            to plan the coupled layout and tow-ball.
          </div>
        )}

        <div className="rounded-2xl border border-tb-neutral-200 bg-white p-4">
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 rounded-lg bg-tb-primary px-3 py-2 text-sm font-semibold text-white hover:bg-tb-primary/90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save layout'}
            </button>
            <button type="button" onClick={handleContribute} disabled={!hasPositions}
              className="flex-1 rounded-lg border border-tb-accent/40 bg-tb-accent/5 px-3 py-2 text-sm font-semibold text-tb-accent hover:bg-tb-accent/10 disabled:opacity-50">
              Share layout
            </button>
          </div>
          {savedMsg && <p className="mt-2 text-xs text-tb-success">{savedMsg}</p>}
          {contribMsg && <p className="mt-2 text-xs text-gray-500">{contribMsg}</p>}
        </div>
      </aside>
    </div>
  );
}
