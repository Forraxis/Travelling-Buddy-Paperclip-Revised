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

  // Fail fast on misconfiguration: in production a missing AUTH_SECRET / OAuth /
  // site URL (or a half-set R2 config) aborts boot with one readable error
  // instead of every request 500ing later. In dev this only warns.
  const { validateEnv } = await import('@/lib/env');
  try {
    validateEnv();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') throw err;
    console.warn(`[env] ${err instanceof Error ? err.message : String(err)}`);
  }

  if (process.env.WORKERS_DISABLED === 'true') return;

  const { startWorkers } = await import('@/lib/workers');
  startWorkers();
}
