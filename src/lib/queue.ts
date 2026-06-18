import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: IORedis };

export const redis =
  globalForRedis.redis ||
  new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL?.startsWith('rediss://')
      ? { rejectUnauthorized: true }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('connect', () => {
  console.log('[queue] Redis connected');
});
redis.on('error', (err) => {
  console.error('[queue] Redis error:', err);
});

const connection = redis;

export const submissionVlmQueue = new Queue('submission-vlm', { connection });
export const photoPostprocessQueue = new Queue('photo-postprocess', {
  connection,
});
// Vehicle-spec fetch (qwen/claude) runs async like the VLM pipeline. The worker
// is gated behind SPEC_FETCH_LIVE_ENABLED so it can never persist live model
// output unless explicitly enabled (the MOCK provider runs synchronously and
// does not use this queue).
export const specFetchQueue = new Queue('spec-fetch', { connection });
// ROVER catalogue crawl (incremental import of RVSA approval consumer reports).
// A repeatable (cron) job whose worker is gated behind ROVER_CRAWL_ENABLED — it
// can never crawl or persist until explicitly enabled (and the real crawler/parser
// are slotted in). Scaffold + synthetic-proven only.
export const roverCrawlQueue = new Queue('rover-crawl', { connection });

export const queues = [
  submissionVlmQueue,
  photoPostprocessQueue,
  specFetchQueue,
  roverCrawlQueue,
];
