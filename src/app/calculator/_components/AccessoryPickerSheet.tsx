'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AccessorySearchTab } from '@/components/calculator/accessory-picker/AccessorySearchTab';
import { AccessoryBrowseTab } from '@/components/calculator/accessory-picker/AccessoryBrowseTab';
import {
  readRecentAccessories,
  writeRecentAccessory,
} from '@/components/calculator/accessory-picker/types';
import type { AccessoryItem } from '@/components/calculator/accessory-picker/types';

export interface PickedAccessoryData {
  accessoryId: string;
  accessoryName: string;
  massKg: number;
  mountingLocation: string;
}

export function formatMountingLocation(loc: string): string {
  return loc
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  vehicleVariantId: string;
  existingAccessoryIds: Set<string>;
  onSelect: (data: PickedAccessoryData) => void;
  onClose: () => void;
}

export function AccessoryPickerSheet({
  existingAccessoryIds,
  onSelect,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const [recent, setRecent] = useState<AccessoryItem[]>([]);

  useEffect(() => {
    setRecent(
      readRecentAccessories().filter(
        (a) => !existingAccessoryIds.has(a.accessoryId),
      ),
    );
  }, [existingAccessoryIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = dy;
    if (dy > 0 && panelRef.current) {
      panelRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 100) {
      onClose();
    } else if (panelRef.current) {
      panelRef.current.style.transform = '';
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  const handleAdd = useCallback(
    (item: AccessoryItem) => {
      if (existingAccessoryIds.has(item.accessoryId)) return;
      writeRecentAccessory(item);
      onSelect({
        accessoryId: item.accessoryId,
        accessoryName: `${item.brandName} ${item.name}`,
        massKg: item.installedWeightKg,
        mountingLocation: item.mountingLocation,
      });
    },
    [existingAccessoryIds, onSelect],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — desktop: 480px slide-over from right; mobile: full-screen sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add accessory"
        className={[
          'fixed z-50 flex flex-col bg-white shadow-2xl',
          'inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl',
          'lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-0 lg:h-full lg:w-[480px] lg:rounded-none',
          'transition-transform duration-300',
        ].join(' ')}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Mobile drag handle */}
        <div className="flex flex-none items-center justify-center pt-3 lg:hidden">
          <div
            className="h-1 w-10 rounded-full bg-gray-300"
            aria-hidden="true"
          />
        </div>

        {/* Header */}
        <div className="border-tb-neutral-200 flex flex-none items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            Add accessory
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-tb-neutral-50 rounded-full p-1.5 text-gray-400 transition-colors hover:text-gray-700"
            aria-label="Close picker"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Search / Browse tabs */}
        <div className="border-tb-neutral-200 flex flex-none border-b">
          {(['search', 'browse'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-tb-primary text-tb-primary border-b-2'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'search' ? 'Search' : 'Browse'}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3">
          {activeTab === 'search' ? (
            <AccessorySearchTab recent={recent} onAdd={handleAdd} />
          ) : (
            <AccessoryBrowseTab onAdd={handleAdd} />
          )}
        </div>

        {/* Footer */}
        <div className="border-tb-neutral-200 flex flex-none items-center justify-center border-t bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-xs text-gray-400">
            Select an accessory above to add it to your build
          </p>
        </div>
      </div>
    </>
  );
}
