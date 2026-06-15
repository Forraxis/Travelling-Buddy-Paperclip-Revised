// Pure aggregation helpers for the community position pipeline. Kept free of
// Prisma/Next so the median logic is unit-testable in isolation.

export interface PositionSample {
  cogXMm: number;
  cogYMm: number;
}

export interface PositionAggregate {
  cogXMm: number;
  cogYMm: number;
  sampleCount: number;
}

/** Median of a numeric list (average of the two middle values when even). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Reduce a set of community-contributed placements to a single canonical
 * position. Median (not mean) so a few wild drags don't drag the consensus.
 * Returns null when there are no samples.
 */
export function aggregatePositions(
  samples: PositionSample[],
): PositionAggregate | null {
  if (samples.length === 0) return null;
  return {
    cogXMm: median(samples.map((s) => s.cogXMm)),
    cogYMm: median(samples.map((s) => s.cogYMm)),
    sampleCount: samples.length,
  };
}
