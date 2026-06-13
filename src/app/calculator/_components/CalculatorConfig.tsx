'use client';

import { VehiclePanel } from './VehiclePanel';
import { CaravanPanel } from './CaravanPanel';

export function CalculatorConfig() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:w-[55%] md:flex-none lg:w-[60%]">
      {/* Vehicle panel — picker + journey assumptions + accessories */}
      <section className="border-tb-neutral-200 mb-4 rounded-lg border bg-white p-6">
        <p className="mb-3 text-sm font-medium text-gray-500">Vehicle</p>
        <VehiclePanel />
      </section>

      {/* Caravan panel */}
      <CaravanPanel />

      {/* Mobile bottom spacer — keeps last element above sticky results bar (~88pt) */}
      <div className="h-[88px] md:hidden" />
    </div>
  );
}
