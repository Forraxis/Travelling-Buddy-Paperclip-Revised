import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runRoverCrawlJob,
  type RoverCrawlDeps,
} from '../../workers/rover-crawl.worker';
import {
  SyntheticRoverCrawler,
  SyntheticRoverParser,
  SYNTHETIC_APPROVAL_REF,
  type RoverCandidateDraft,
  type RoverHighWaterMark,
} from '../rover';

function deps(
  highWater: RoverHighWaterMark,
  ingest: RoverCrawlDeps['ingest'],
): RoverCrawlDeps {
  return {
    crawler: new SyntheticRoverCrawler(),
    parser: new SyntheticRoverParser(),
    highWater,
    ingest,
  };
}

function fakeIngest() {
  return vi.fn((draft: RoverCandidateDraft) =>
    Promise.resolve({
      candidateId: `cand-${draft.ref.vtaNumber}`,
      refreshed: false,
      fieldCount: draft.fields.length,
    }),
  );
}

describe('runRoverCrawlJob safety gate', () => {
  beforeEach(() => {
    delete process.env.ROVER_CRAWL_ENABLED;
  });
  afterEach(() => {
    delete process.env.ROVER_CRAWL_ENABLED;
  });

  it('does NOTHING when the gate is closed (no crawl, no ingest)', async () => {
    const ingest = fakeIngest();
    const result = await runRoverCrawlJob(deps({}, ingest));
    expect(result.status).toBe('gated');
    expect(result.imported).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('imports the synthetic approval and advances the high-water mark when enabled', async () => {
    process.env.ROVER_CRAWL_ENABLED = 'true';
    const ingest = fakeIngest();
    const result = await runRoverCrawlJob(deps({}, ingest));

    expect(result.status).toBe('ok');
    expect(result.imported).toBe(1);
    expect(ingest).toHaveBeenCalledTimes(1);
    // High-water mark advanced to the approval's publish date for its category.
    expect(result.highWater.NA).toBe(SYNTHETIC_APPROVAL_REF.publishedOn);
    // The synthetic report is fully extracted → no health alert.
    expect(result.healthAlert).toBeNull();
  });

  it('is idempotent: a re-run past the high-water mark imports nothing and flags zero records', async () => {
    process.env.ROVER_CRAWL_ENABLED = 'true';
    const ingest = fakeIngest();
    const result = await runRoverCrawlJob(
      deps({ NA: SYNTHETIC_APPROVAL_REF.publishedOn }, ingest),
    );

    expect(result.imported).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
    expect(result.healthAlert).toMatch(/zero approvals/i);
  });
});
