import type { RoverSecondStageType } from '@prisma/client';

/**
 * Renders the classified second-stage type (P2) for a skeleton row. NONE means a
 * base/OEM variant — shown muted so the eye skips to the second-stage rows
 * (GVM_UPGRADE / CONVERSION / MOTORHOME / OTHER) that drive overlay promotion.
 */
const STYLES: Record<RoverSecondStageType, { label: string; cls: string }> = {
  NONE: { label: 'Base', cls: 'bg-gray-100 text-gray-500' },
  GVM_UPGRADE: { label: 'GVM upgrade', cls: 'bg-emerald-50 text-emerald-700' },
  CONVERSION: { label: 'Conversion', cls: 'bg-sky-50 text-sky-700' },
  MOTORHOME: { label: 'Motorhome', cls: 'bg-violet-50 text-violet-700' },
  OTHER: { label: 'Other 2nd', cls: 'bg-amber-50 text-amber-700' },
};

export function TypeBadge({ type }: { type: RoverSecondStageType }) {
  const { label, cls } = STYLES[type] ?? STYLES.NONE;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}
