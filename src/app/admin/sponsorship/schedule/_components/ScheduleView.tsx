'use client';

import type { PlacementDto } from '@/modules/sponsorship/actions/sponsor-admin.actions';

const SPONSOR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
];

const typeLabel: Record<string, string> = {
  ACCESSORY_FEATURED: 'Accessory',
  CATEGORY_TOP: 'Category',
  RECOMMENDATION_PINNED: 'Recommendation',
  VEHICLE_TYPE_FEATURED: 'Vehicle Type',
};

function scopeKey(p: PlacementDto): string {
  if (p.accessoryId) return `accessory:${p.accessoryId}`;
  if (p.categoryId) return `category:${p.categoryId}`;
  if (p.vehicleBodyType) return `vehicle:${p.vehicleBodyType}`;
  return 'recommendation:global';
}

function scopeLabel(p: PlacementDto): string {
  if (p.accessoryName) return p.accessoryName;
  if (p.categoryName) return p.categoryName;
  if (p.vehicleBodyType) return p.vehicleBodyType.replace(/_/g, ' ');
  return 'Global (Upgrade Pathway)';
}

function formatDay(d: Date) {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function ScheduleView({ placements }: { placements: PlacementDto[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Build 13-week column headers (Mon–Sun)
  const weeks: { start: Date; end: Date; label: string }[] = [];
  const firstMonday = new Date(today);
  const day = firstMonday.getDay();
  firstMonday.setDate(firstMonday.getDate() - (day === 0 ? 6 : day - 1));
  for (let i = 0; i < 13; i++) {
    const wStart = new Date(
      firstMonday.getTime() + i * 7 * 24 * 60 * 60 * 1000,
    );
    const wEnd = new Date(wStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    weeks.push({ start: wStart, end: wEnd, label: formatDay(wStart) });
  }

  // Unique sponsor → color mapping
  const sponsorIds = Array.from(new Set(placements.map((p) => p.sponsorId)));
  const sponsorColor = Object.fromEntries(
    sponsorIds.map((id, i) => [id, SPONSOR_COLORS[i % SPONSOR_COLORS.length]]),
  );

  // Group by scope
  const groups = new Map<
    string,
    { label: string; type: string; rows: PlacementDto[] }
  >();
  for (const p of placements) {
    const k = scopeKey(p);
    if (!groups.has(k)) {
      groups.set(k, {
        label: scopeLabel(p),
        type: typeLabel[p.placementType] ?? p.placementType,
        rows: [],
      });
    }
    groups.get(k)!.rows.push(p);
  }

  if (placements.length === 0) {
    return (
      <div className="border-tb-neutral-200 rounded-lg border px-6 py-12 text-center text-gray-500">
        No placements scheduled in the next 90 days.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {sponsorIds.map((id) => {
          const sponsor = placements.find((p) => p.sponsorId === id);
          return (
            <div
              key={id}
              className="flex items-center gap-1.5 text-sm text-gray-700"
            >
              <span
                className={`inline-block h-3 w-3 rounded-sm ${sponsorColor[id]}`}
              />
              {sponsor?.sponsorName}
            </div>
          );
        })}
      </div>

      {/* Gantt table */}
      <div className="border-tb-neutral-200 overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-tb-neutral-200 bg-tb-neutral-50 border-b">
              <th className="w-48 px-4 py-2 text-left font-medium text-gray-700">
                Scope
              </th>
              <th className="w-24 px-2 py-2 text-left font-medium text-gray-500">
                Type
              </th>
              {weeks.map((w) => (
                <th
                  key={w.start.toISOString()}
                  className={`min-w-[64px] px-1 py-2 text-center font-medium ${
                    w.start <= today && today <= w.end
                      ? 'text-tb-primary'
                      : 'text-gray-500'
                  }`}
                >
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).map(([key, group]) =>
              group.rows.map((placement, ri) => (
                <tr
                  key={placement.id}
                  className="border-tb-neutral-200 hover:bg-tb-neutral-50 border-b last:border-0"
                >
                  {ri === 0 && (
                    <td
                      rowSpan={group.rows.length}
                      className="border-tb-neutral-200 border-r px-4 py-2 align-top font-medium text-gray-900"
                    >
                      {group.label}
                    </td>
                  )}
                  {ri === 0 && (
                    <td
                      rowSpan={group.rows.length}
                      className="border-tb-neutral-200 border-r px-2 py-2 align-top text-gray-500"
                    >
                      {group.type}
                    </td>
                  )}
                  {weeks.map((week) => {
                    const pStart = new Date(placement.startsAt);
                    const pEnd = new Date(placement.endsAt);
                    const overlaps = pStart <= week.end && pEnd >= week.start;
                    return (
                      <td
                        key={week.start.toISOString()}
                        className="px-1 py-1.5"
                      >
                        {overlaps && (
                          <div
                            className={`flex h-5 items-center justify-center overflow-hidden rounded text-xs text-white ${sponsorColor[placement.sponsorId]}`}
                            title={`${placement.sponsorName} — ${placement.tier}`}
                          >
                            <span className="truncate px-1">
                              {placement.sponsorName}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Showing placements from {formatDay(today)} to {formatDay(end90)}.
        Grouped by scope, colour-coded by sponsor.
      </p>
    </div>
  );
}
