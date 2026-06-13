import type { Worker } from 'bullmq';
import { createSubmissionVlmWorker } from './submission-vlm.worker';
import { createPhotoPostprocessWorker } from './photo-postprocess.worker';

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  if (workers.length > 0) return workers;

  workers = [createSubmissionVlmWorker(), createPhotoPostprocessWorker()];

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
