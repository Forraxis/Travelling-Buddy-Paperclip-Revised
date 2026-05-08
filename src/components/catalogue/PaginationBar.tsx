import Link from "next/link";

interface Props {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  nextCursor: string | null;
  hasMore: boolean;
}

function buildUrl(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((val) => p.append(k, val));
    } else {
      p.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      p.delete(k);
    } else {
      p.set(k, v);
    }
  }
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function PaginationBar({ basePath, searchParams, nextCursor, hasMore }: Props) {
  const hasPrev = !!searchParams.cursor;

  if (!hasPrev && !hasMore) return null;

  const prevUrl = buildUrl(basePath, searchParams, { cursor: undefined });
  const nextUrl = hasMore && nextCursor
    ? buildUrl(basePath, searchParams, { cursor: nextCursor })
    : null;

  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      {hasPrev ? (
        <Link
          href={prevUrl}
          className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        >
          ← Previous
        </Link>
      ) : (
        <div />
      )}
      {nextUrl && (
        <Link
          href={nextUrl}
          className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        >
          Next →
        </Link>
      )}
    </div>
  );
}
