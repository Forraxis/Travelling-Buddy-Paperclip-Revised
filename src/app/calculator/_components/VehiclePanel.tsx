'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';
import { EntityPicker, VEHICLE_CONFIG } from '@/components/calculator/picker';
import type { PickerVariant } from '@/components/calculator/picker';
import { AccessoryPickerSheet, formatMountingLocation } from './AccessoryPickerSheet';
import type { PickedAccessoryData } from './AccessoryPickerSheet';

// Placeholder tank capacity — real value would come from vehicle variant data
const DEFAULT_TANK_L = 80;

function fuelDensityKgPerL(fuelType?: string): number {
  if (fuelType?.toLowerCase().includes('diesel')) return 0.835;
  return 0.74; // petrol
}

// ── Fuel section ──────────────────────────────────────────────────────────────

interface FuelSectionProps {
  variant: PickerVariant;
}

function FuelSection({ variant }: FuelSectionProps) {
  const { state, setJourney } = useCalculatorState();
  const { fuelPercent } = state.journey;
  const density = fuelDensityKgPerL(variant.fuelType);
  const fuelKg = Math.round((fuelPercent / 100) * DEFAULT_TANK_L * density);

  const presets = [
    { label: 'Full', value: 100 },
    { label: 'Half', value: 50 },
    { label: 'Reserve', value: 10 },
  ] as const;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Fuel level</label>
        <span className="text-sm tabular-nums text-gray-500">{fuelKg} kg</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={fuelPercent}
        onChange={(e) => setJourney({ fuelPercent: Number(e.target.value) })}
        className="w-full accent-[#2e75b6]"
        aria-label="Fuel level"
      />
      <div className="mt-2 flex gap-1.5">
        {presets.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setJourney({ fuelPercent: value })}
            className={[
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              fuelPercent === value
                ? 'border-[#2e75b6] bg-[#2e75b6] text-white'
                : 'border-[#e5e7eb] bg-white text-gray-600 hover:border-[#2e75b6] hover:text-[#2e75b6]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Passengers section ────────────────────────────────────────────────────────

function PassengersSection() {
  const { state, setJourney } = useCalculatorState();
  const { passengers, passengerWeightKg } = state.journey;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">Passengers</label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-[#e5e7eb] bg-white">
          <button
            type="button"
            onClick={() => setJourney({ passengers: Math.max(0, passengers - 1) })}
            disabled={passengers === 0}
            aria-label="Remove passenger"
            className="px-3 py-1.5 text-base text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            −
          </button>
          <span
            className="w-8 select-none text-center text-sm font-semibold tabular-nums"
            aria-live="polite"
          >
            {passengers}
          </span>
          <button
            type="button"
            onClick={() => setJourney({ passengers: Math.min(9, passengers + 1) })}
            disabled={passengers === 9}
            aria-label="Add passenger"
            className="px-3 py-1.5 text-base text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Avg weight</span>
          <input
            type="number"
            min={30}
            max={200}
            value={passengerWeightKg}
            onChange={(e) =>
              setJourney({
                passengerWeightKg: Math.min(200, Math.max(30, Number(e.target.value))),
              })
            }
            aria-label="Average passenger weight in kg"
            className="w-16 rounded-md border border-[#e5e7eb] px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#2e75b6]"
          />
          <span className="text-xs text-gray-500">kg</span>
        </div>
      </div>
    </div>
  );
}

// ── Cargo section ─────────────────────────────────────────────────────────────

function CargoSection() {
  const { state, setJourney } = useCalculatorState();

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle cargo</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={9999}
          value={state.journey.cargoKg || ''}
          onChange={(e) =>
            setJourney({ cargoKg: Math.max(0, Number(e.target.value)) })
          }
          placeholder="0"
          aria-label="Vehicle cargo in kg"
          className="w-24 rounded-md border border-[#e5e7eb] px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#2e75b6]"
        />
        <span className="text-xs text-gray-500">kg</span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function VehiclePanel() {
  const { state, setVehicleVariant, addAccessory, removeAccessory } = useCalculatorState();
  const [selectedVariant, setSelectedVariant] = useState<PickerVariant | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Local map of accessoryId → display name (massKg & mountingLocation live in state)
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const resolveInflight = useRef(false);

  const handleSelect = useCallback(
    (variant: PickerVariant) => {
      setSelectedVariant(variant);
      setVehicleVariant(variant.id);
    },
    [setVehicleVariant],
  );

  // Fetch names for accessories already in state (e.g. restored from URL params)
  useEffect(() => {
    const missing = state.accessories
      .map((a) => a.accessoryId)
      .filter((id) => !nameMap.has(id));
    if (missing.length === 0 || resolveInflight.current) return;
    resolveInflight.current = true;
    fetch('/api/calculator/fitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessoryIds: missing }),
    })
      .then((r) => r.json())
      .then((items: { accessoryId: string; name: string }[]) => {
        setNameMap((prev) => {
          const next = new Map(prev);
          for (const item of items) next.set(item.accessoryId, item.name);
          return next;
        });
      })
      .catch(() => {/* silently fail — chips show placeholder */})
      .finally(() => { resolveInflight.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accessories]);

  const handlePickerSelect = useCallback(
    (data: PickedAccessoryData) => {
      addAccessory({
        accessoryId: data.accessoryId,
        massKg: data.massKg,
        mountingLocation: data.mountingLocation,
      });
      setNameMap((prev) => {
        const next = new Map(prev);
        next.set(data.accessoryId, data.accessoryName);
        return next;
      });
      setPickerOpen(false);
    },
    [addAccessory],
  );

  const handleRemove = useCallback(
    (accessoryId: string) => {
      removeAccessory(accessoryId);
      setNameMap((prev) => {
        const next = new Map(prev);
        next.delete(accessoryId);
        return next;
      });
    },
    [removeAccessory],
  );

  const existingAccessoryIds = new Set(state.accessories.map((a) => a.accessoryId));
  const totalAccessoryKg = state.accessories.reduce((sum, a) => sum + a.massKg, 0);

  return (
    <section>
      {/* Vehicle picker — renders empty-state CTA or compact card */}
      <EntityPicker config={VEHICLE_CONFIG} onSelect={handleSelect} />

      {selectedVariant && (
        <>
          {/* Journey assumptions */}
          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Journey assumptions
            </p>
            <div className="space-y-4 divide-y divide-[#e5e7eb]">
              <FuelSection variant={selectedVariant} />
              <div className="pt-4">
                <PassengersSection />
              </div>
              <div className="pt-4">
                <CargoSection />
              </div>
            </div>
          </div>

          {/* Accessories */}
          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Accessories
            </p>

            {state.accessories.length === 0 ? (
              /* Empty state CTA */
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full rounded-md border border-dashed border-[#e5e7eb] px-3 py-3 text-sm text-gray-400 transition-colors hover:border-[#2e75b6] hover:text-[#2e75b6]"
              >
                + Add accessory
              </button>
            ) : (
              <>
                {/* Chip list — wraps on desktop, horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible">
                  {state.accessories.map((a) => {
                    const name = nameMap.get(a.accessoryId);
                    if (!name) {
                      return (
                        <div
                          key={a.accessoryId}
                          className="h-7 w-36 shrink-0 animate-pulse rounded-full bg-gray-100"
                        />
                      );
                    }
                    return (
                      <span
                        key={a.accessoryId}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-xs text-gray-700"
                      >
                        <span className="font-medium">{name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="tabular-nums">{a.massKg} kg</span>
                        <span className="text-gray-400">·</span>
                        <span>{formatMountingLocation(a.mountingLocation)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(a.accessoryId)}
                          aria-label={`Remove ${name}`}
                          className="ml-0.5 text-gray-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Mass summary */}
                <p className="mt-3 text-xs tabular-nums text-gray-500">
                  Accessories: {Math.round(totalAccessoryKg)} kg
                </p>

                {/* Add more */}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="mt-2 text-xs text-[#2e75b6] hover:underline"
                >
                  + Add accessory
                </button>
              </>
            )}
          </div>

          {pickerOpen && (
            <AccessoryPickerSheet
              vehicleVariantId={selectedVariant.id}
              existingAccessoryIds={existingAccessoryIds}
              onSelect={handlePickerSelect}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
