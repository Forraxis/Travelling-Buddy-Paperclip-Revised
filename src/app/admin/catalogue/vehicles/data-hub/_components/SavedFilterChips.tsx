import Link from 'next/link';

/**
 * First-class saved-filter chips for the data hub. Each chip is a one-click
 * navigation to a curated subset of the ROVER skeleton index — the three
 * standing work queues a curator lives in:
 *
 *  - Needs expand — skeletons still UNFETCHED (no RVD spec yet).
 *  - Needs AI     — normalization left them NEEDS_REVIEW (base make/model
 *                   couldn't be resolved confidently → AI/human next).
 *  - Needs review — NEEDS_REVIEW rows that have already been EXPANDED, so a
 *                   human can curate base make/model against real spec data.
 *
 * Pure presentational: the parent decides which chip is active and supplies the
 * count + href (built from the same `linkTo` query-merge the filter form uses),
 * so chips compose with the search box and other facets instead of clobbering
 * them.
 */
export type SavedFilterChip = {
  key: string;
  label: string;
  href: string;
  count: number;
  active: boolean;
};

export function SavedFilterChips({ chips }: { chips: SavedFilterChip[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
        Queues
      </span>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-pressed={chip.active}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            chip.active
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
          }`}
        >
          {chip.label}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              chip.active
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {chip.count.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
}
