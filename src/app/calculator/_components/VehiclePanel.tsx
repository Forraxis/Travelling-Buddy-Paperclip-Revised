'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';
import { EntityPicker, VEHICLE_CONFIG } from '@/components/calculator/picker';
import type { PickerVariant } from '@/components/calculator/picker';
import { AccessoryPicker } from '@/components/calculator/accessory-picker';
import type { AccessoryItem } from '@/components/calculator/accessory-picker';

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
        <span className="text-sm text-gray-500 tabular-nums">{fuelKg} kg</span>
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
      <label className="mb-2 block text-sm font-medium text-gray-700">
        Passengers
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-[#e5e7eb] bg-white">
          <button
            type="button"
            onClick={() =>
              setJourney({ passengers: Math.max(0, passengers - 1) })
            }
            disabled={passengers === 0}
            aria-label="Remove passenger"
            className="px-3 py-1.5 text-base text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            −
          </button>
          <span
            className="w-8 text-center text-sm font-semibold tabular-nums select-none"
            aria-live="polite"
          >
            {passengers}
          </span>
          <button
            type="button"
            onClick={() =>
              setJourney({ passengers: Math.min(9, passengers + 1) })
            }
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
                passengerWeightKg: Math.min(
                  200,
                  Math.max(30, Number(e.target.value)),
                ),
              })
            }
            aria-label="Average passenger weight in kg"
            className="w-16 rounded-md border border-[#e5e7eb] px-2 py-1 text-right text-sm tabular-nums focus:ring-1 focus:ring-[#2e75b6] focus:outline-none"
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
      <label className="mb-2 block text-sm font-medium text-gray-700">
        Vehicle cargo
      </label>
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
          className="w-24 rounded-md border border-[#e5e7eb] px-2 py-1.5 text-right text-sm tabular-nums focus:ring-1 focus:ring-[#2e75b6] focus:outline-none"
        />
        <span className="text-xs text-gray-500">kg</span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function VehiclePanel() {
  const { state, setVehicleVariant, addAccessory, removeAccessory } =
    useCalculatorState();
  const [selectedVariant, setSelectedVariant] = useState<PickerVariant | null>(
    null,
  );

  // Hydrate from URL-persisted vehicleVariantId on mount
  useEffect(() => {
    if (!state.vehicleVariantId || selectedVariant) return;
    fetch(`/api/v1/vehicles/variants/${state.vehicleVariantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (!v) return;
        const pv: PickerVariant = {
          id: v.id,
          name: v.name,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
          isCurrentProduction: v.isCurrentProduction,
          entityType: 'vehicle',
          makeId: v.model.make.id,
          makeName: v.model.make.name,
          makeLogoUrl: v.model.make.logoUrl,
          modelId: v.model.id,
          modelName: v.model.name,
          bodyType: v.model.bodyType,
          gvmKg: v.gvmKg ?? undefined,
          gcmKg: v.gcmKg ?? undefined,
          kerbWeightKg: v.kerbWeightKg ?? undefined,
          maxTowingCapacityKg: v.maxTowingCapacityKg ?? undefined,
          fuelType: v.fuelType ?? undefined,
        };
        setSelectedVariant(pv);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.vehicleVariantId]);

  const handleSelect = useCallback(
    (variant: PickerVariant) => {
      setSelectedVariant(variant);
      setVehicleVariant(variant.id);
    },
    [setVehicleVariant],
  );

  // AccessoryPicker uses fitmentId; we store it as accessoryId in calculator state
  const handleAdd = useCallback(
    (item: AccessoryItem) => {
      addAccessory({
        accessoryId: item.fitmentId,
        massKg: item.installedWeightKg,
        mountingLocation: item.mountingLocation,
        label: item.name,
        // Seed the drag start from the canonical (community/OEM) placement when
        // one exists, so promoted consensus positions show up immediately.
        cogXMm: item.cogXMm,
        cogYMm: item.cogYMm,
        topDownImageUrl: item.topDownImageUrl,
      });
    },
    [addAccessory],
  );

  const handleRemove = useCallback(
    (fitmentId: string) => {
      removeAccessory(fitmentId);
    },
    [removeAccessory],
  );

  const totalAccessoryKg = state.accessories.reduce(
    (sum, a) => sum + a.massKg,
    0,
  );
  // addedFitmentIds: the state uses accessoryId field to store what is actually a fitmentId
  const addedFitmentIds = state.accessories.map((a) => a.accessoryId);

  return (
    <section>
      {/* Vehicle picker — renders empty-state CTA or compact card */}
      <EntityPicker
        config={VEHICLE_CONFIG}
        onSelect={handleSelect}
        initialVariant={selectedVariant}
      />

      {selectedVariant && (
        <>
          {/* Journey assumptions */}
          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-white p-4">
            <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
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
            <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Accessories
            </p>

            <AccessoryPicker
              onAdd={handleAdd}
              onRemove={handleRemove}
              addedFitmentIds={addedFitmentIds}
            />

            {/* Mass summary — only shown when accessories are present */}
            {state.accessories.length > 0 && (
              <p className="mt-3 text-xs text-gray-500 tabular-nums">
                Accessories: {Math.round(totalAccessoryKg)} kg
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
