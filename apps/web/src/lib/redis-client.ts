import IORedis from "ioredis";

export async function getRedis(): Promise<IORedis> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not set");

  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: {},
    lazyConnect: true,
  });

  await redis.connect();
  return redis;
}
