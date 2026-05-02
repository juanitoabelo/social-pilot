import { Redis } from "ioredis";
function createSub(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not set");
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
const sub = createSub();
sub.on("connect", () => console.log("[Redis Sub] Connected"));
sub.on("error", (e) => console.error("[Redis Sub] Error:", e.message));
export { sub };