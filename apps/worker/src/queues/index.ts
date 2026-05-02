import { Queue, Worker as BullMQWorker, type Job } from "bullmq";
import { redis } from "../lib/redis";
export const QUEUE_NAMES = {
  CONTENT_GENERATION: "content-generation",
  IMAGE_GENERATION: "image-generation",
  SCHEDULED_POSTS: "scheduled-posts",
  METRICS_FETCH: "metrics-fetch",
} as const;
export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}
export function createWorker(
  name: string,
  processor: (job: Job) => Promise<unknown>,
  concurrency = 2
): BullMQWorker {
  return new BullMQWorker(name, processor, {
    connection: redis,
    concurrency,
  });
}
export class ContentWorker {
  private queues: Queue[] = [];
  private workers: BullMQWorker[] = [];
  async close() {
    console.log("Closing BullMQ workers and queues...");
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled(this.queues.map((q) => q.close()));
  }
}