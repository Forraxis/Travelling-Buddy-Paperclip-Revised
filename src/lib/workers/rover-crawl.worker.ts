/**
 * Repeatable ROVER catalogue-crawl worker — the incremental import skeleton.
 *
 * ⚠️ SAFETY GATE: gated behind ROVER_CRAWL_ENABLED === 'true'. With the flag unset
 * (the default) `runRoverCrawlJob` does NOTHING — no crawl, no parse, no DB write —
 * and returns a 'gated' status, so a scheduled run can never import data before the
 * real crawler/parser are built and Tim approves access + the gate level.
 *
 * The job is dependency-injected (crawler / parser / ingest / high-water mark) so
 * the plumbing — list → fetch → parse → verify → ingest, advance the per-category
 * high-water mark, and emit a crawl-health signal — is proven against the synthetic
 * crawler with no network. Swap the defaults for the real `PdfRoverParser` + live
 * directory crawler when the sample lands; callers don't change.
 *
 * TODO(tim): before enabling — (1) build PdfRoverParser against a real consumer
 * report; (2) build the live directory crawler; (3) persist the high-water mark
 * (AdminConfig) across runs instead of starting empty each time; (4) confirm the
 * gate level (auto-promote-with-audit vs batch-approve) — this skeleton lands every
 * candidate as PENDING regardless; (5) set ROVER_CRAWL_ENABLED=true and register a
 * repeatable job on roverCrawlQueue.
 */
import { Worker, type Job } from 'bullmq';
import { redis } from '@/lib/queue';
import {
  RoverVerifier,
  SyntheticRoverCrawler,
  SyntheticRoverParser,
  createRoverCandidate,
  ROVER_CATEGORIES,
  type IngestRoverResult,
  type RoverCandidateDraft,
  type RoverDirectoryCrawler,
  type RoverHighWaterMark,
  type RoverReportParser,
} from '@/lib/spec-fetch/rover';

/** Below this run-level extraction confidence, flag the crawler as possibly broken. */
const EXTRACTION_CONFIDENCE_FLOOR = 0.5;

export interface RoverCrawlDeps {
  crawler: RoverDirectoryCrawler;
  parser: RoverReportParser;
  /** Per-category high-water mark to start from (the worker advances + returns it). */
  highWater: RoverHighWaterMark;
  ingest: (draft: RoverCandidateDraft) => Promise<IngestRoverResult>;
}

export interface RoverCrawlResult {
  status: 'gated' | 'ok';
  imported: number;
  refreshed: number;
  /** Advanced per-category high-water mark to persist for the next run. */
  highWater: RoverHighWaterMark;
  /** Set when the run looks like a broken crawler (zero records, or low confidence). */
  healthAlert: string | null;
}

function liveEnabled(): boolean {
  return process.env.ROVER_CRAWL_ENABLED === 'true';
}

/** Default deps: synthetic crawler + parser. No network; clearly-marked fixture data. */
function defaultDeps(highWater: RoverHighWaterMark = {}): RoverCrawlDeps {
  return {
    crawler: new SyntheticRoverCrawler(),
    parser: new SyntheticRoverParser(),
    highWater,
    ingest: createRoverCandidate,
  };
}

/**
 * Testable job core. Returns counts + the advanced high-water mark. Does nothing
 * when the live gate is closed.
 */
export async function runRoverCrawlJob(
  deps: RoverCrawlDeps = defaultDeps(),
): Promise<RoverCrawlResult> {
  if (!liveEnabled()) {
    return {
      status: 'gated',
      imported: 0,
      refreshed: 0,
      highWater: deps.highWater,
      healthAlert: null,
    };
  }

  const verifier = new RoverVerifier(deps.parser);
  const highWater: RoverHighWaterMark = { ...deps.highWater };
  let imported = 0;
  let refreshed = 0;
  let minConfidence = 1;

  for (const category of ROVER_CATEGORIES) {
    const approvals = await deps.crawler.listNewApprovals(
      category,
      highWater[category],
    );
    for (const ref of approvals) {
      const source = await deps.crawler.fetchReport(ref);
      const draft = await verifier.verify(source);
      minConfidence = Math.min(minConfidence, draft.extractionConfidence);
      const result = await deps.ingest(draft);
      if (result.refreshed) refreshed += 1;
      else imported += 1;
      // Advance the high-water mark to the newest publish date seen.
      const seen = highWater[category];
      if (!seen || ref.publishedOn > seen) {
        highWater[category] = ref.publishedOn;
      }
    }
  }

  // Crawl-health: a run that finds nothing, or whose extraction confidence sank,
  // is more likely a broken scraper than a quiet week — flag it for review. (The
  // "N consecutive empty weeks" tracking that needs cross-run state is a TODO.)
  let healthAlert: string | null = null;
  if (imported === 0 && refreshed === 0) {
    healthAlert =
      'ROVER crawl found zero approvals — verify the directory/parser is not broken.';
  } else if (minConfidence < EXTRACTION_CONFIDENCE_FLOOR) {
    healthAlert = `ROVER extraction confidence ${minConfidence.toFixed(
      2,
    )} below floor ${EXTRACTION_CONFIDENCE_FLOOR} — parser may be stale.`;
  }

  return { status: 'ok', imported, refreshed, highWater, healthAlert };
}

export function createRoverCrawlWorker(): Worker {
  return new Worker('rover-crawl', async (_job: Job) => runRoverCrawlJob(), {
    connection: redis,
    concurrency: 1,
  });
}
