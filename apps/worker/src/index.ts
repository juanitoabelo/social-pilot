import "./setup";
import { startContentWorker } from "./queues/content-worker";
import { createContentQueue } from "./queues/content-worker";

// Debug: Log environment variables to see if they're loaded
console.log("[Worker] NODE_ENV:", process.env.NODE_ENV);
console.log("[Worker] REDIS_URL:", process.env.REDIS_URL ? "SET" : "NOT SET");
if (process.env.REDIS_URL) {
  console.log("[Worker] REDIS_URL (first 20 chars):", process.env.REDIS_URL.substring(0, 20));
}

const queues = [createContentQueue()];
let workers: Awaited<ReturnType<typeof startContentWorker>>[] = [];

async function startup() {
  console.log("[Worker] Starting content worker...");
  const worker = await startContentWorker();
  workers.push(worker);
  console.log("[Worker] Content worker running. PID:", process.pid);
}

async function shutdown(signal: string) {
  console.log(`\n[Worker] ${signal} received — shutting down gracefully...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled(queues.map((q) => q.close()));
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startup().catch((e) => {
  console.error("[Worker] Startup failed:", e);
  process.exit(1);
});