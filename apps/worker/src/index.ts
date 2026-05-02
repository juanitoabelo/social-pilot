import "./setup";
import "./sentry";
import { startContentWorker, createContentQueue } from "./queues/content-worker";
import { startScheduledPostsWorker, createScheduledPostsQueue } from "./queues/scheduled-posts";
import { startTokenRefreshWorker, createTokenRefreshQueue, scheduleTokenRefreshChecks } from "./queues/token-refresh";
import { startMetricsFetchWorker, createMetricsFetchQueue, scheduleMetricsCron } from "./queues/metrics-fetch";
import { startNotificationsWorker, createNotificationsQueue, scheduleWeeklyDigests, schedulePlanLimitChecks } from "./queues/notifications";

console.log("[Worker] NODE_ENV:", process.env.NODE_ENV);
console.log("[Worker] REDIS_URL:", process.env.REDIS_URL ? "SET" : "NOT SET");
if (process.env.REDIS_URL) {
  console.log("[Worker] REDIS_URL (first 20 chars):", process.env.REDIS_URL.substring(0, 20));
}

const queues = [
  createContentQueue(),
  createScheduledPostsQueue(),
  createTokenRefreshQueue(),
  createMetricsFetchQueue(),
  createNotificationsQueue(),
];

let workers: (
  | Awaited<ReturnType<typeof startContentWorker>>
  | Awaited<ReturnType<typeof startScheduledPostsWorker>>
  | Awaited<ReturnType<typeof startTokenRefreshWorker>>
  | Awaited<ReturnType<typeof startMetricsFetchWorker>>
  | Awaited<ReturnType<typeof startNotificationsWorker>>
)[] = [];

async function startup() {
  console.log("[Worker] Starting workers...");

  const contentWorker = await startContentWorker();
  workers.push(contentWorker);
  console.log("[Worker] Content worker running. PID:", process.pid);

  const publisherWorker = await startScheduledPostsWorker();
  workers.push(publisherWorker);
  console.log("[Worker] Publisher worker running.");

  const tokenRefreshWorker = await startTokenRefreshWorker();
  workers.push(tokenRefreshWorker);
  console.log("[Worker] Token refresh worker running.");

  const metricsWorker = await startMetricsFetchWorker();
  workers.push(metricsWorker);
  console.log("[Worker] Metrics fetch worker running.");

  await scheduleTokenRefreshChecks();
  console.log("[Worker] Token refresh checks scheduled.");

  await scheduleMetricsCron();
  console.log("[Worker] Metrics cron scheduled.");

  const notificationsWorker = await startNotificationsWorker();
  workers.push(notificationsWorker);
  console.log("[Worker] Notifications worker running.");

  await scheduleWeeklyDigests();
  console.log("[Worker] Weekly digests scheduled.");

  await schedulePlanLimitChecks();
  console.log("[Worker] Plan limit checks scheduled.");
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
