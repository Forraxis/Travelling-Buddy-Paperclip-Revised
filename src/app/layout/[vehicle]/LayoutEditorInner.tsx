'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';
import { useSetupSave } from '@/components/calculator/hooks/useSetupSave';
import { AccessoryPicker } from '@/components/calculator/accessory-picker';
import type { AccessoryItem } from '@/components/calculator/accessory-picker';
import type { CustomLoad } from '@/modules/calculator/types';
import CoupledRigCanvas from '@/components/schematic/CoupledRigCanvas';
import { WeighbridgeCalibrationPanel } from '@/components/calibration/WeighbridgeCalibrationPanel';
import { SetupVersionsPanel } from '@/components/versions/SetupVersionsPanel';

type Side = 'vehicle' | 'caravan';

export function LayoutEditorInner({
  vehicleName,
  setupId: setupIdProp,
}: {
  vehicleName: string;
  setupId: string | null;
}) {
  const {
    state,
    addAccessory,
    removeAccessory,
    addCaravanAccessory,
    removeCaravanAccessory,
    setAccessoryPosition,
    setCaravanAccessoryPosition,
    addCustomLoad,
    removeCustomLoad,
    setCustomLoadPosition,
  } = useCalculatorState();
  const view = usePhysicsView();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The live setupId: the prop seeds it; after a fresh save we promote the new
  // id into the URL so subsequent saves PATCH and the versions panel activates.
  const setupId = searchParams.get('setupId') ?? setupIdProp;
  const { save, saving } = useSetupSave(setupId, {
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
        label: item.name,
        cogXMm: item.cogXMm,
        cogYMm: item.cogYMm,
        topDownImageUrl: item.topDownImageUrl,
      }),
    [addAccessory],
  );
  const addCaravan = useCallback(
    (item: AccessoryItem) =>
      addCaravanAccessory({
        accessoryId: item.fitmentId,
        massKg: item.installedWeightKg,
        mountingLocation: item.mountingLocation,
        label: item.name,
        cogXMm: item.cogXMm,
        cogYMm: item.cogYMm,
        topDownImageUrl: item.topDownImageUrl,
      }),
    [addCaravanAccessory],
  );

  const isCustom = useCallback(
    (id: string) => state.customLoads.some((l) => l.id === id),
    [state.customLoads],
  );
  const onMove = useCallback(
    (side: Side, id: string, x: number, y: number) => {
      if (isCustom(id)) setCustomLoadPosition(id, x, y);
      else if (side === 'vehicle') setAccessoryPosition(id, x, y);
      else setCaravanAccessoryPosition(id, x, y);
    },
    [
      isCustom,
      setCustomLoadPosition,
      setAccessoryPosition,
      setCaravanAccessoryPosition,
    ],
  );
  const onRemove = useCallback(
    (side: Side, id: string) => {
      if (isCustom(id)) removeCustomLoad(id);
      else if (side === 'vehicle') removeAccessory(id);
      else removeCaravanAccessory(id);
    },
    [isCustom, removeCustomLoad, removeAccessory, removeCaravanAccessory],
  );

  async function handleSave() {
    setSavedMsg(null);
    const res = await save();
    if (!res.ok) {
      setSavedMsg('Save failed.');
      return;
    }
    if (res.isAnonymous) {
      setSavedMsg('Saved on this device — sign in to sync and keep versions.');
      return;
    }
    if (setupId) {
      setSavedMsg('Setup updated.');
      return;
    }
    // First save of a new setup: promote its id into the URL so later saves
    // update it (PATCH) and the versions panel activates — same as the calculator.
    if (res.id) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('setupId', res.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    setSavedMsg('Saved — versions are now available below.');
  }

  async function handleContribute() {
    setContribMsg(null);
    const vehItems = state.accessories.filter(
      (a) => a.cogXMm != null && a.cogYMm != null,
    );
    const calls: Promise<Response>[] = [];
    if (state.vehicleVariantId && vehItems.length) {
      calls.push(
        fetch('/api/fitments/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleVariantId: state.vehicleVariantId,
            source: 'layout-editor',
            items: vehItems.map((a) => ({
              fitmentId: a.accessoryId,
              cogXMm: Math.round(a.cogXMm!),
              cogYMm: Math.round(a.cogYMm!),
            })),
          }),
        }),
      );
    }
    const vanItems = state.caravanAccessories.filter(
      (a) => a.cogXMm != null && a.cogYMm != null,
    );
    if (state.caravanVariantId && vanItems.length) {
      calls.push(
        fetch('/api/fitments/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caravanVariantId: state.caravanVariantId,
            source: 'layout-editor',
            items: vanItems.map((a) => ({
              fitmentId: a.accessoryId,
              cogXMm: Math.round(a.cogXMm!),
              cogYMm: Math.round(a.cogYMm!),
            })),
          }),
        }),
      );
    }
    if (!calls.length) {
      setContribMsg('Position something first, then share it.');
      return;
    }
    const results = await Promise.all(calls);
    setContribMsg(
      results.every((r) => r.ok)
        ? 'Thanks! Submitted for review.'
        : 'Some items could not be submitted.',
    );
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
          <div className="border-tb-neutral-200 flex h-64 items-center justify-center rounded-2xl border border-dashed text-sm text-gray-400">
            Loading your rig…
          </div>
        )}
      </div>

      <aside className="order-1 space-y-4 lg:order-2">
        <div className="border-tb-neutral-200 rounded-2xl border bg-white p-4">
          <h2 className="text-tb-ink text-sm font-semibold">
            Vehicle accessories
          </h2>
          <p className="mb-2 text-xs text-gray-500">
            Add gear, then drag it into place.
          </p>
          <AccessoryPicker
            onAdd={addVehicle}
            onRemove={removeAccessory}
            addedFitmentIds={state.accessories.map((a) => a.accessoryId)}
            context="vehicle"
          />
        </div>

        {state.caravanVariantId ? (
          <div className="border-tb-neutral-200 rounded-2xl border bg-white p-4">
            <h2 className="text-tb-ink text-sm font-semibold">
              Caravan accessories
            </h2>
            <p className="mb-2 text-xs text-gray-500">
              Mounted gear moves the tow-ball.
            </p>
            <AccessoryPicker
              onAdd={addCaravan}
              onRemove={removeCaravanAccessory}
              addedFitmentIds={state.caravanAccessories.map(
                (a) => a.accessoryId,
              )}
              context="caravan"
            />
          </div>
        ) : (
          <div className="border-tb-neutral-200 rounded-2xl border border-dashed bg-white/60 p-4 text-xs text-gray-500">
            Towing? Open this rig with a caravan attached from the{' '}
            <Link
              href="/calculator/"
              className="text-tb-primary font-medium underline"
            >
              calculator
            </Link>{' '}
            to plan the coupled layout and tow-ball.
          </div>
        )}

        <CustomLoadForm
          hasCaravan={!!state.caravanVariantId}
          onCreate={(load) => addCustomLoad(load)}
        />

        <WeighbridgeCalibrationPanel />

        <div className="border-tb-neutral-200 rounded-2xl border bg-white p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-tb-primary hover:bg-tb-primary/90 flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save layout'}
            </button>
            <button
              type="button"
              onClick={handleContribute}
              disabled={!hasPositions}
              className="border-tb-accent/40 bg-tb-accent/5 text-tb-accent hover:bg-tb-accent/10 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Share layout
            </button>
          </div>
          {savedMsg && (
            <p className="text-tb-success mt-2 text-xs">{savedMsg}</p>
          )}
          {contribMsg && (
            <p className="mt-2 text-xs text-gray-500">{contribMsg}</p>
          )}
        </div>

        {setupId && (
          <div className="border-tb-neutral-200 rounded-2xl border bg-white p-4">
            <SetupVersionsPanel />
          </div>
        )}
      </aside>
    </div>
  );
}

function CustomLoadForm({
  hasCaravan,
  onCreate,
}: {
  hasCaravan: boolean;
  onCreate: (load: CustomLoad) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [weight, setWeight] = useState('');
  const [side, setSide] = useState<'vehicle' | 'caravan'>('vehicle');
  const [len, setLen] = useState('');
  const [wid, setWid] = useState('');

  function submit() {
    const massKg = parseFloat(weight);
    if (!label.trim() || isNaN(massKg) || massKg <= 0) return;
    onCreate({
      id: `custom:${crypto.randomUUID()}`,
      label: label.trim(),
      massKg,
      side: hasCaravan ? side : 'vehicle',
      cogXMm: null,
      cogYMm: null,
      footprintLengthMm: len ? Math.round(parseFloat(len)) : null,
      footprintWidthMm: wid ? Math.round(parseFloat(wid)) : null,
    });
    setLabel('');
    setWeight('');
    setLen('');
    setWid('');
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="border-tb-neutral-200 rounded-2xl border bg-white p-4">
        <h2 className="text-tb-ink text-sm font-semibold">Custom load</h2>
        <p className="mb-2 text-xs text-gray-500">
          Add anything not in the catalogue — a fridge, water, firewood — just
          for your rig. Branded product? Use “+ Add accessory” to submit it for
          review.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-tb-neutral-300 text-tb-primary hover:bg-tb-neutral-50 w-full rounded-lg border border-dashed px-3 py-2 text-sm font-medium"
        >
          + Create custom item
        </button>
      </div>
    );
  }

  return (
    <div className="border-tb-primary/30 space-y-2 rounded-2xl border bg-white p-4">
      <h2 className="text-tb-ink text-sm font-semibold">New custom item</h2>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name (e.g. 40L fridge)"
        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          inputMode="decimal"
          placeholder="Weight (kg)"
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
        />
        {hasCaravan && (
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as 'vehicle' | 'caravan')}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="vehicle">Vehicle</option>
            <option value="caravan">Caravan</option>
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={len}
          onChange={(e) => setLen(e.target.value)}
          inputMode="numeric"
          placeholder="Length mm (opt)"
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs"
        />
        <input
          value={wid}
          onChange={(e) => setWid(e.target.value)}
          inputMode="numeric"
          placeholder="Width mm (opt)"
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          className="bg-tb-primary hover:bg-tb-primary/90 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
        >
          Add to rig
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
