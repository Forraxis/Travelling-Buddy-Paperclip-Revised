import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractPdfText } from '../rover/pdf';
import { parseRvdText, type RvdDocument } from '../rover/rvd-parser';
import { diffRvdFigures } from '../rover/amendment';

// Real ROVER amendment pairs committed under docs/RVD/. These pin the figure-level
// diff to actual re-issues (not a synthetic fixture).
const DIR = 'docs/RVD';

async function loadRvd(name: string): Promise<RvdDocument> {
  const buf = await readFile(join(DIR, name));
  const { text } = await extractPdfText(new Uint8Array(buf));
  return parseRvdText(text);
}

describe('diffRvdFigures — real corpus amendment pairs', () => {
  let patrolA: RvdDocument;
  let patrolB: RvdDocument;
  let navaraA: RvdDocument;
  let navaraB: RvdDocument;
  let ramA: RvdDocument;
  let ramB: RvdDocument;

  beforeAll(async () => {
    [patrolA, patrolB, navaraA, navaraB, ramA, ramB] = await Promise.all([
      loadRvd('Road Vehicle Descriptor - VTA-044896 20230828.pdf'),
      loadRvd('Road Vehicle Descriptor - VTA-044896 20251014.pdf'),
      loadRvd('Road Vehicle Descriptor - VTA-047155 20250409.pdf'),
      loadRvd('Road Vehicle Descriptor - VTA-047155 20250701.pdf'),
      loadRvd('Road Vehicle Descriptor - VTA-047365 20241115.pdf'),
      loadRvd('Road Vehicle Descriptor - VTA-047365 20260206.pdf'),
    ]);
  }, 60_000);

  it('Patrol 044896: variant NAMES changed (re-label) → NO_FIGURE_CHANGE', () => {
    // The hash differs (it is a real amendment)…
    expect(patrolA.contentHash).not.toBe(patrolB.contentHash);
    // …but the variants were re-labelled ("Ti (Mid)" → "468"), so no variant is
    // matched by name → no tracked figure can be said to have moved.
    const diff = diffRvdFigures(patrolA, patrolB);
    expect(diff.status).toBe('NO_FIGURE_CHANGE');
    expect(diff.changes).toHaveLength(0);
  });

  it('Navara 047155: same variants, identical figures → NO_FIGURE_CHANGE', () => {
    expect(navaraA.contentHash).not.toBe(navaraB.contentHash);
    const diff = diffRvdFigures(navaraA, navaraB);
    expect(diff.status).toBe('NO_FIGURE_CHANGE');
    expect(diff.changes).toHaveLength(0);
  });

  it('RAM 047365: tare changed on stable-named variants → FIGURE_CHANGED', () => {
    const diff = diffRvdFigures(ramA, ramB);
    expect(diff.status).toBe('FIGURE_CHANGED');
    expect(diff.changes.length).toBeGreaterThan(0);
    // Every reported change is on the tare→kerb figure (GVM/tow/dims held).
    expect(diff.changes.every((c) => c.field === 'kerbWeightKg')).toBe(true);
    const shortBox = diff.changes.find(
      (c) => c.variant === 'DJ 2500 Short Box',
    );
    expect(shortBox).toMatchObject({
      field: 'kerbWeightKg',
      from: '3520',
      to: '3616',
    });
  });

  it('is reflexive: a version diffed against itself is NO_FIGURE_CHANGE', () => {
    expect(diffRvdFigures(ramB, ramB).status).toBe('NO_FIGURE_CHANGE');
  });
});
