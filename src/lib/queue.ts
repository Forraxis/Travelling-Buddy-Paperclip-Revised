import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis };

export const redis =
  globalForRedis.redis ||
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls:
      process.env.REDIS_URL?.startsWith("rediss://")
        ? { rejectUnauthorized: true }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("connect", () => {
  console.log("[queue] Redis connected");
});
redis.on("error", (err) => {
  console.error("[queue] Redis error:", err);
});

const connection = redis;

export const submissionVlmQueue = new Queue("submission-vlm", { connection });
export const photoPostprocessQueue = new Queue("photo-postprocess", {
  connection,
});

export const queues = [submissionVlmQueue, photoPostprocessQueue];
