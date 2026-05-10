'use client';

import { useState, useCallback } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';
import type { PickerVariant } from '@/components/calculator/picker';
import { CompactCard, CARAVAN_CONFIG } from '@/components/calculator/picker';
import { PickerShell } from '@/components/calculator/picker/PickerShell';
import { SearchTab } from '@/components/calculator/picker/SearchTab';
import { BrowseTab } from '@/components/calculator/picker/BrowseTab';
import { useRecent } from '@/components/calculator/picker/hooks/useRecent';

const WATER_ACCENT = '#2563eb';

interface WaterTankSectionProps {
  label: string;
  capacityL: number;
  percent: number;
  onChange: (v: number) => void;
}

function WaterTankSection({ label, capacityL, percent, onChange }: WaterTankSectionProps) {
  const massKg = Math.round((percent / 100) * capacityL);

  const presets = [
    { label: 'Full', value: 100 },
    { label: 'Half', value: 50 },
    { label: 'Quarter', value: 25 },
  ] as const;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm tabular-nums text-gray-500">{massKg} kg</span>
      </div>
      <p className="mb-1.5 text-[11px] text-gray-400">
        Tank: {capacityL} L &nbsp;·&nbsp; {percent}% full
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: WATER_ACCENT }}
        aria-label={`${label} fill level`}
      />
      <div className="mt-2 flex gap-1.5">
        {presets.map(({ label: pLabel, value }) => (
          <button
            key={pLabel}
            type="button"
            onClick={() => onChange(value)}
            className={[
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              percent === value
                ? 'border-[#2563eb] bg-[#2563eb] text-white'
                : 'border-[#e5e7eb] bg-white text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb]',
            ].join(' ')}
          >
            {pLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CaravanPanel() {
  const { state, setCaravanVariant, setCaravanAssumptions, setJourney } = useCalculatorState();
  const [selectedVariant, setSelectedVariant] = useState<PickerVariant | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const { recent, addRecent } = useRecent('caravan');
  const { caravanAssumptions, journey } = state;

  const openPicker = useCallback(() => setIsOpen(true), []);
  const closePicker = useCallback(() => setIsOpen(false), []);

  const handleSelect = useCallback(
    (variant: PickerVariant) => {
      setSelectedVariant(variant);
      addRecent(variant);
      setIsOpen(false);
      setCaravanVariant(variant.id);
    },
    [addRecent, setCaravanVariant],
  );

  const handleRemove = useCallback(() => {
    setSelectedVariant(null);
    setCaravanVariant(null);
    setCaravanAssumptions({ freshWaterL: 0, greyWaterL: 0, gearKg: 0 });
  }, [setCaravanVariant, setCaravanAssumptions]);

  const handleSubmitClick = useCallback(() => {
    // Submission flow — spec §7.8 (not yet implemented)
  }, []);

  const pickerDialog = isOpen && (
    <PickerShell
      isOpen={isOpen}
      onClose={closePicker}
      config={CARAVAN_CONFIG}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSubmitClick={handleSubmitClick}
    >
      {activeTab === 'search' ? (
        <SearchTab config={CARAVAN_CONFIG} recent={recent} onSelect={handleSelect} />
      ) : (
        <BrowseTab config={CARAVAN_CONFIG} onSelect={handleSelect} />
      )}
    </PickerShell>
  );

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!selectedVariant) {
    return (
      <>
        <section className="rounded-lg border border-dashed border-tb-neutral-200 bg-tb-neutral-50/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-medium text-gray-400">Caravan / Trailer</p>
            <span className="rounded-full bg-tb-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Optional
            </span>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="flex h-14 w-full items-center justify-center rounded-md border-2 border-dashed border-tb-neutral-200 text-gray-400 transition-colors hover:border-tb-primary-light hover:text-tb-primary-light"
            aria-label="Add caravan or trailer"
          >
            <span className="text-sm">+ Add caravan or trailer</span>
          </button>
        </section>
        {pickerDialog}
      </>
    );
  }

  // ── Full panel (caravan attached) ────────────────────────────────────────

  return (
    <>
      <section className="rounded-lg border border-tb-neutral-200 bg-white p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-gray-500">Caravan / Trailer</p>
            <span className="rounded-full bg-tb-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Optional
            </span>
          </div>
        </div>

        {/* Compact selected card */}
        <CompactCard variant={selectedVariant} config={CARAVAN_CONFIG} onChange={openPicker} />

        {/* Journey assumptions */}
        <div className="mt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Journey assumptions
          </p>
          <div className="space-y-4 divide-y divide-tb-neutral-100">
            {selectedVariant.freshWaterCapacityL != null && selectedVariant.freshWaterCapacityL > 0 ? (
              <WaterTankSection
                label="Fresh water"
                capacityL={selectedVariant.freshWaterCapacityL}
                percent={journey.freshWaterPercent}
                onChange={(v) => setJourney({ freshWaterPercent: v })}
              />
            ) : null}
            {selectedVariant.greyWaterCapacityL != null && selectedVariant.greyWaterCapacityL > 0 ? (
              <div className={selectedVariant.freshWaterCapacityL != null && selectedVariant.freshWaterCapacityL > 0 ? 'pt-4' : ''}>
                <WaterTankSection
                  label="Grey water"
                  capacityL={selectedVariant.greyWaterCapacityL}
                  percent={journey.greyWaterPercent}
                  onChange={(v) => setJourney({ greyWaterPercent: v })}
                />
              </div>
            ) : null}
            <div className={
              (selectedVariant.freshWaterCapacityL ?? 0) > 0 || (selectedVariant.greyWaterCapacityL ?? 0) > 0
                ? 'pt-4'
                : ''
            }>
              <div className="flex items-center gap-2 py-1">
                <span className="min-w-0 flex-1 text-xs text-gray-500">Gear inside</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={1}
                    value={caravanAssumptions.gearKg === 0 ? '' : caravanAssumptions.gearKg}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      setCaravanAssumptions({ gearKg: isNaN(raw) ? 0 : Math.max(0, Math.min(2000, raw)) });
                    }}
                    className="w-20 rounded border border-tb-neutral-200 bg-white px-2 py-1 text-right text-xs text-gray-900 focus:border-tb-primary-light focus:outline-none focus:ring-1 focus:ring-tb-primary-light"
                    aria-label="Gear inside caravan"
                  />
                  <span className="w-5 text-right text-[11px] text-gray-400">kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accessories stub */}
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Accessories
          </p>
          <p className="text-xs text-gray-400">Accessory fitments coming soon.</p>
        </div>

        {/* Remove caravan */}
        <div className="mt-4 border-t border-tb-neutral-100 pt-3">
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-gray-400 transition-colors hover:text-red-500"
          >
            Remove caravan
          </button>
        </div>
      </section>
      {pickerDialog}
    </>
  );
}
