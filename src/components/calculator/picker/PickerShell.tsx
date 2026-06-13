'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { PickerConfig } from './types';

interface PickerShellProps {
  isOpen: boolean;
  onClose: () => void;
  config: PickerConfig;
  activeTab: 'search' | 'browse';
  onTabChange: (tab: 'search' | 'browse') => void;
  onSubmitClick: () => void;
  children: ReactNode;
}

export function PickerShell({
  isOpen,
  onClose,
  config,
  activeTab,
  onTabChange,
  onSubmitClick,
  children,
}: PickerShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Swipe-down dismiss for mobile sheet
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — desktop: slide-over from right (480px); mobile: bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Select ${config.label}`}
        className={[
          'fixed z-50 flex flex-col bg-white shadow-2xl',
          // Mobile: full-screen bottom sheet
          'inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl',
          // Desktop: right slide-over
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
            Select {config.label}
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

        {/* Tabs */}
        <div className="border-tb-neutral-200 flex flex-none border-b">
          {(['search', 'browse'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3">
          {children}
        </div>

        {/* Persistent footer CTA */}
        <div className="border-tb-neutral-200 flex flex-none items-center justify-between border-t bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onSubmitClick}
            className="text-tb-primary-light text-sm underline-offset-2 hover:underline"
          >
            {config.label.charAt(0).toUpperCase() + config.label.slice(1)} not
            listed? <span className="font-medium">{config.submitLabel}</span>
          </button>
        </div>
      </div>
    </>
  );
}
