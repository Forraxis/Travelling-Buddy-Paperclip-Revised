'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PickerVariant, PickerConfig } from './types';
import { useRecent } from './hooks/useRecent';
import { PickerShell } from './PickerShell';
import { SearchTab } from './SearchTab';
import { BrowseTab } from './BrowseTab';
import { CompactCard } from './CompactCard';

interface EntityPickerProps {
  config: PickerConfig;
  /** Called when the user finalises a variant selection. */
  onSelect?: (variant: PickerVariant) => void;
  /** Pre-selected variant, e.g. restored from URL state. */
  initialVariant?: PickerVariant | null;
}

export function EntityPicker({
  config,
  onSelect,
  initialVariant,
}: EntityPickerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const [selected, setSelected] = useState<PickerVariant | null>(
    initialVariant ?? null,
  );
  const { recent, addRecent } = useRecent(config.entityType);

  // Sync when the parent resolves the variant asynchronously
  useEffect(() => {
    if (initialVariant && !selected) {
      setSelected(initialVariant);
    }
  }, [initialVariant, selected]);

  const openPicker = useCallback(() => setIsOpen(true), []);
  const closePicker = useCallback(() => setIsOpen(false), []);

  const handleSelect = useCallback(
    (variant: PickerVariant) => {
      setSelected(variant);
      addRecent(variant);
      setIsOpen(false);
      onSelect?.(variant);
    },
    [addRecent, onSelect],
  );

  const handleSubmitClick = useCallback(() => {
    const url =
      config.entityType === 'vehicle' ? '/submit/vehicle' : '/submit/caravan';
    router.push(url);
  }, [config.entityType, router]);

  // ── Empty state panel ──────────────────────────────────────────────────

  if (!selected) {
    const isCaravan = config.entityType === 'caravan';
    return (
      <>
        <button
          type="button"
          onClick={openPicker}
          className={[
            'flex h-20 w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors',
            isCaravan
              ? 'border-tb-neutral-200 hover:border-tb-primary-light hover:text-tb-primary-light text-gray-400'
              : 'border-tb-neutral-200 hover:border-tb-primary-light hover:text-tb-primary-light text-gray-400',
          ].join(' ')}
          aria-label={`Select ${config.label}`}
        >
          <span className="text-sm">
            {isCaravan ? '+ Add caravan or trailer' : 'Select your vehicle'}
          </span>
        </button>

        {isOpen && (
          <PickerShell
            isOpen={isOpen}
            onClose={closePicker}
            config={config}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSubmitClick={handleSubmitClick}
          >
            {activeTab === 'search' ? (
              <SearchTab
                config={config}
                recent={recent}
                onSelect={handleSelect}
              />
            ) : (
              <BrowseTab config={config} onSelect={handleSelect} />
            )}
          </PickerShell>
        )}
      </>
    );
  }

  // ── Compact card (selected state) ─────────────────────────────────────

  return (
    <>
      <CompactCard variant={selected} config={config} onChange={openPicker} />

      {isOpen && (
        <PickerShell
          isOpen={isOpen}
          onClose={closePicker}
          config={config}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSubmitClick={handleSubmitClick}
        >
          {activeTab === 'search' ? (
            <SearchTab
              config={config}
              recent={recent}
              onSelect={handleSelect}
            />
          ) : (
            <BrowseTab config={config} onSelect={handleSelect} />
          )}
        </PickerShell>
      )}
    </>
  );
}
