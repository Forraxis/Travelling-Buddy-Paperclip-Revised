'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AccessoryItem } from './types';
import { readRecentAccessories, writeRecentAccessory } from './types';
import { AccessorySearchTab } from './AccessorySearchTab';
import { AccessoryBrowseTab } from './AccessoryBrowseTab';
import { AccessoryChip } from './AccessoryChip';

interface AccessoryPickerProps {
  onAdd: (item: AccessoryItem) => void;
  onRemove: (fitmentId: string) => void;
  addedFitmentIds: string[];
}

function AccessoryPickerModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: AccessoryItem) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');
  const [recent, setRecent] = useState<AccessoryItem[]>([]);

  useEffect(() => {
    if (isOpen) setRecent(readRecentAccessories());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

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

  const handleAdd = useCallback((item: AccessoryItem) => {
    writeRecentAccessory(item);
    onAdd(item);
    onClose();
  }, [onAdd, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add accessory"
        className={[
          'fixed z-50 flex flex-col bg-white shadow-2xl',
          'inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl',
          'lg:inset-x-auto lg:bottom-0 lg:right-0 lg:top-0 lg:h-full lg:w-[480px] lg:rounded-none',
          'transition-transform duration-300',
        ].join(' ')}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Mobile drag handle */}
        <div className="flex flex-none items-center justify-center pt-3 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex flex-none items-center justify-between border-b border-tb-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Add accessory</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-tb-neutral-50 hover:text-gray-700"
            aria-label="Close picker"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-none border-b border-tb-neutral-200">
          {(['search', 'browse'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-tb-primary text-tb-primary'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'search' ? 'Search' : 'Browse'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3">
          {activeTab === 'search' ? (
            <AccessorySearchTab recent={recent} onAdd={handleAdd} />
          ) : (
            <AccessoryBrowseTab onAdd={handleAdd} />
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-none items-center justify-center border-t border-tb-neutral-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export function AccessoryPicker({ onAdd, onRemove, addedFitmentIds }: AccessoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addedItems, setAddedItems] = useState<AccessoryItem[]>([]);

  const openPicker = useCallback(() => setIsOpen(true), []);
  const closePicker = useCallback(() => setIsOpen(false), []);

  const handleAdd = useCallback((item: AccessoryItem) => {
    setAddedItems((prev) => {
      if (prev.some((a) => a.fitmentId === item.fitmentId)) return prev;
      return [...prev, item];
    });
    onAdd(item);
  }, [onAdd]);

  const handleRemove = useCallback((fitmentId: string) => {
    setAddedItems((prev) => prev.filter((a) => a.fitmentId !== fitmentId));
    onRemove(fitmentId);
  }, [onRemove]);

  // Sync removals made externally (e.g. reset)
  const visibleItems = addedItems.filter((a) => addedFitmentIds.includes(a.fitmentId));

  return (
    <>
      {/* Chip list */}
      {visibleItems.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {visibleItems.map((item) => (
            <AccessoryChip key={item.fitmentId} item={item} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={openPicker}
        className="w-full rounded-md border border-dashed border-[#e5e7eb] px-3 py-2 text-sm text-tb-primary-light transition-colors hover:border-tb-primary hover:bg-tb-primary-lighter"
      >
        + Add accessory
      </button>

      <AccessoryPickerModal
        isOpen={isOpen}
        onClose={closePicker}
        onAdd={handleAdd}
      />
    </>
  );
}
