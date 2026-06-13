/**
 * Next.js instrumentation hook — runs once when the server process boots.
 *
 * Starts the BullMQ workers (submission VLM + photo post-process) in-process so
 * the async submission pipeline actually runs on a single-VPS deployment without
 * a separate worker process. Guarded to the Node.js runtime (BullMQ/ioredis are
 * node-only) and skipped during build or when WORKERS_DISABLED=true (e.g. if you
 * prefer running workers as a standalone process via src/lib/workers).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.WORKERS_DISABLED === 'true') return;

  const { startWorkers } = await import('@/lib/workers');
  startWorkers();
}
