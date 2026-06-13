'use client';

import type { AccessoryItem } from './types';

function mountingLabel(location: string) {
  return location.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AccessoryChipProps {
  item: AccessoryItem;
  onRemove: (fitmentId: string) => void;
}

export function AccessoryChip({ item, onRemove }: AccessoryChipProps) {
  const isCommunity = item.fitmentId.startsWith('community:');
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-full border bg-white py-1.5 pr-1.5 pl-3',
        isCommunity ? 'border-amber-300' : 'border-tb-neutral-200',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <span className="truncate text-xs font-medium text-gray-800">
          {item.brandName} {item.name}
        </span>
        {isCommunity && (
          <span className="ml-1.5 text-[10px] font-medium text-amber-600">
            Awaiting review
          </span>
        )}
        <span className="ml-1.5 text-[10px] text-gray-400">
          {mountingLabel(item.mountingLocation)} · {item.installedWeightKg} kg
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.fitmentId)}
        aria-label={`Remove ${item.name}`}
        className="hover:bg-tb-neutral-100 flex-none rounded-full p-0.5 text-gray-400 transition-colors hover:text-gray-600"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
