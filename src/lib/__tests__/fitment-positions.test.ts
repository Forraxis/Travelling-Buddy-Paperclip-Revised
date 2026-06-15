import { describe, expect, it } from 'vitest';
import { median, aggregatePositions } from '../fitment-positions';

describe('median', () => {
  it('returns 0 for an empty list', () => {
    expect(median([])).toBe(0);
  });

  it('returns the middle value for odd-length lists', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length lists', () => {
    expect(median([1, 2, 3, 4])).toBe(3); // round((2+3)/2) = 3
  });

  it('handles negative values (lateral, left side)', () => {
    expect(median([-100, -50, 0])).toBe(-50);
  });

  it('is robust to a single wild outlier', () => {
    expect(median([100, 110, 105, 9000])).toBe(108); // round((105+110)/2)
  });
});

describe('aggregatePositions', () => {
  it('returns null with no samples', () => {
    expect(aggregatePositions([])).toBeNull();
  });

  it('medians x and y independently and reports the count', () => {
    const agg = aggregatePositions([
      { cogXMm: 1000, cogYMm: -200 },
      { cogXMm: 1100, cogYMm: -180 },
      { cogXMm: 1050, cogYMm: -190 },
    ]);
    expect(agg).toEqual({ cogXMm: 1050, cogYMm: -190, sampleCount: 3 });
  });

  it('ignores an outlier drag in the consensus', () => {
    const agg = aggregatePositions([
      { cogXMm: 1000, cogYMm: 0 },
      { cogXMm: 1020, cogYMm: 10 },
      { cogXMm: 1010, cogYMm: 5 },
      { cogXMm: 5000, cogYMm: 900 },
    ]);
    // Median keeps the consensus near the cluster, not pulled to 5000/900.
    expect(agg?.cogXMm).toBe(1015);
    expect(agg?.cogYMm).toBe(8);
    expect(agg?.sampleCount).toBe(4);
  });
});
