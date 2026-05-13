import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/queue";

export interface PhotoPostprocessJobData {
  photoKey: string;
  userId: string;
}

export function createPhotoPostprocessWorker(): Worker<PhotoPostprocessJobData> {
  return new Worker<PhotoPostprocessJobData>(
    "photo-postprocess",
    async (job: Job<PhotoPostprocessJobData>) => {
      // Task 10.6 will implement server-side photo processing here
      console.log(
        `[worker:photo-postprocess] job ${job.id} — photoKey=${job.data.photoKey}`
      );
    },
    {
      connection: redis,
      concurrency: 4,
    }
  );
}
