import { Redis } from "ioredis";
function createRedis(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not set");
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: {},
    retryStrategy(times) {
      if (times > 10) {
        console.error("[Redis] Max retries reached — giving up");
        return null;
      }
      return Math.min(times * 200, 20000);
    },
  });
}
const redis = createRedis();
redis.on("connect", () => console.log("[Redis] Connected"));
redis.on("error", (e) => console.error("[Redis] Error:", e.message));
redis.on("close", () => console.warn("[Redis] Connection closed"));
export { redis };