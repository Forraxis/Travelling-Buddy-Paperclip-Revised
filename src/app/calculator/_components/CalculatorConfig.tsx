"use client";

import { useCalculatorState } from "@/modules/calculator/context";
import { EntityPicker, VEHICLE_CONFIG, CARAVAN_CONFIG } from "@/components/calculator/picker";
import type { PickerVariant } from "@/components/calculator/picker";

export function CalculatorConfig() {
  const { setVehicleVariant, setCaravanVariant } = useCalculatorState();

  function handleVehicleSelect(variant: PickerVariant) {
    setVehicleVariant(variant.id);
  }

  function handleCaravanSelect(variant: PickerVariant) {
    setCaravanVariant(variant.id);
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:w-[55%] md:flex-none lg:w-[60%]">
      {/* Vehicle panel */}
      <section className="mb-4 rounded-lg border border-tb-neutral-200 bg-white p-6">
        <p className="mb-3 text-sm font-medium text-gray-500">Vehicle</p>
        <EntityPicker config={VEHICLE_CONFIG} onSelect={handleVehicleSelect} />
      </section>

      {/* Caravan panel */}
      <section className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <p className="mb-3 text-sm font-medium text-gray-500">Caravan / Trailer</p>
        <EntityPicker config={CARAVAN_CONFIG} onSelect={handleCaravanSelect} />
      </section>

      {/* Mobile spacing */}
      <div className="h-22 md:hidden" />
    </div>
  );
}
