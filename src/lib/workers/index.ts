import type { Worker } from 'bullmq';
import { createSubmissionVlmWorker } from './submission-vlm.worker';
import { createPhotoPostprocessWorker } from './photo-postprocess.worker';
import { createSpecFetchWorker } from './spec-fetch.worker';
// NOTE: the synthetic ROVER crawl worker (createRoverCrawlWorker) is DEPRECATED and
// intentionally NOT registered. ROVER acquisition now runs in n8n, which POSTs to
// /api/rover/ingest; the in-app crawl skeleton is superseded (see ROVER_OVERNIGHT_BUILD.md
// Phase 4 + VEHICLE_DATA_FETCH.md decision 8).

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;

  workers = [
    createSubmissionVlmWorker(),
    createPhotoPostprocessWorker(),
    createSpecFetchWorker(),
  ];

  console.log(`[workers] Started ${workers.length} workers`);
  return workers;
}

export async function stopWorkers(): Promise<void> {
  if (workers.length === 0) return;
  console.log('[workers] Draining and closing workers…');
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  console.log('[workers] All workers stopped');
}

// Graceful shutdown on SIGTERM / SIGINT (used by standalone worker process)
if (typeof process !== 'undefined') {
  const shutdown = async (signal: string) => {
    console.log(`[workers] Received ${signal}, shutting down gracefully`);
    await stopWorkers();
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
