/**
 * @deprecated Superseded by n8n, which owns ROVER acquisition (crawl + download)
 *   and POSTs VTADetails HTML to `POST /api/rover/ingest` (VEHICLE_DATA_FETCH.md
 *   decision 8). Retained for reference only — no longer registered or run. See
 *   ROVER_OVERNIGHT_BUILD.md Phase 4.
 *
 * ROVER directory crawler — behind an interface so the gated repeatable job can be
 * proven against a synthetic source with no live scraping.
 *
 * The real crawler (built only once Tim approves live access) walks the Published
 * Approvals Directory filtered by category, advancing a per-category high-water mark
 * (last VTA / published date seen) and pulling only what's newer — cheap, polite,
 * incremental. `SyntheticRoverCrawler` returns the bundled fixture once (relative to
 * a high-water mark) so the job's plumbing — list → fetch → parse → ingest, plus the
 * high-water advance and crawl-health signal — is exercised without the network.
 */
import { SYNTHETIC_APPROVAL_REF, SYNTHETIC_REPORT_ROWS } from './fixtures';
import type {
  RoverApprovalRef,
  RoverCategory,
  RoverReportSource,
} from './types';

/**
 * Per-category high-water mark: the `publishedOn` of the newest approval already
 * ingested for that category. The crawl lists only approvals published after it.
 */
export type RoverHighWaterMark = Partial<Record<RoverCategory, string>>;

export interface RoverDirectoryCrawler {
  /** Approvals in `category` published strictly after `since` (undefined = from the start). */
  listNewApprovals(
    category: RoverCategory,
    since: string | undefined,
  ): Promise<RoverApprovalRef[]>;
  /** Fetch the consumer report for an approval into a parser-ready source. */
  fetchReport(ref: RoverApprovalRef): Promise<RoverReportSource>;
}

/**
 * Synthetic crawler — surfaces the one bundled fixture in its category, and only
 * when it is newer than the supplied high-water mark (so a second run with the mark
 * advanced returns nothing, exactly like the real incremental crawl reaching the
 * end of the directory). No network, no real data.
 */
export class SyntheticRoverCrawler implements RoverDirectoryCrawler {
  async listNewApprovals(
    category: RoverCategory,
    since: string | undefined,
  ): Promise<RoverApprovalRef[]> {
    if (category !== SYNTHETIC_APPROVAL_REF.category) return [];
    if (since !== undefined && since >= SYNTHETIC_APPROVAL_REF.publishedOn) {
      return [];
    }
    return [SYNTHETIC_APPROVAL_REF];
  }

  async fetchReport(ref: RoverApprovalRef): Promise<RoverReportSource> {
    return { ref, rows: SYNTHETIC_REPORT_ROWS };
  }
}
