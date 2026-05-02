import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { decrypt } from "../lib/crypto";

export const METRICS_FETCH_QUEUE = "metrics-fetch";

export function createMetricsFetchQueue(): Queue {
  return new Queue(METRICS_FETCH_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 120000,
      },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

export async function startMetricsFetchWorker(): Promise<Worker> {
  const worker = new Worker(
    METRICS_FETCH_QUEUE,
    async (job: Job) => {
      console.log(`[MetricsFetch] Processing job ${job.id} for post ${job.data.postId}`);
      return processMetricsJob(job.data, job);
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[MetricsFetch] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[MetricsFetch] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function processMetricsJob(
  data: Record<string, unknown>,
  _job: Job
): Promise<unknown> {
  const { postId } = data as { postId: string };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      campaign: {
        include: {
          workspace: {
            include: {
              platform_connections: {
                where: { platform: undefined },
              },
            },
          },
        },
      },
    },
  });

  if (!post) return { skipped: true, reason: "post not found" };
  if (post.status !== "published") return { skipped: true, reason: "post not published" };
  if (!post.platform_post_id) return { skipped: true, reason: "no platform_post_id" };

  const connection = post.campaign.workspace.platform_connections.find(
    (c) => c.platform === post.platform
  );
  if (!connection) return { skipped: true, reason: "no platform connection" };

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("ENCRYPTION_KEY is not set");

  const accessToken = decrypt(connection.access_token, encryptionKey);

  let metrics: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
    saves: number;
    clicks: number;
    engagement_rate: number;
  };

  if (post.platform === "instagram") {
    metrics = await fetchInstagramMetrics(post.platform_post_id, accessToken);
  } else if (post.platform === "facebook") {
    metrics = await fetchFacebookMetrics(post.platform_post_id, accessToken);
  } else {
    return { skipped: true, reason: "platform not supported" };
  }

  await prisma.postMetrics.create({
    data: {
      post_id: postId,
      platform_post_id: post.platform_post_id,
      ...metrics,
      fetched_at: new Date(),
    },
  });

  return { fetched: true, platform: post.platform, metrics };
}

async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string
) {
  const fields = [
    "likes",
    "comments_count",
    "share_count",
    "saved",
    "reach",
    "impressions",
  ].join(",");

  const params = new URLSearchParams({
    access_token: accessToken,
    fields,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}/insights?${params}`
  );

  if (!response.ok) {
    throw new Error(`Instagram metrics fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: Array<{ name: string; values: Array<{ value: number }> }>;
  };

  const getValue = (name: string): number => {
    const item = data.data.find((d) => d.name === name);
    return item?.values?.[0]?.value ?? 0;
  };

  const likes = getValue("likes");
  const comments = getValue("comments_count");
  const shares = getValue("share_count");
  const saves = getValue("saved");
  const reach = getValue("reach");
  const impressions = getValue("impressions");
  const engagement = likes + comments + shares + saves;
  const engagement_rate = reach > 0 ? engagement / reach : 0;

  return {
    likes,
    comments,
    shares,
    saves,
    reach,
    impressions,
    clicks: 0,
    engagement_rate,
  };
}

async function fetchFacebookMetrics(
  postId: string,
  accessToken: string
) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields:
      "likes.summary(true),comments.summary(true),shares,impressions,reach",
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}?${params}`
  );

  if (!response.ok) {
    throw new Error(`Facebook metrics fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
    impressions?: number;
    reach?: number;
  };

  const likes = data.likes?.summary?.total_count ?? 0;
  const comments = data.comments?.summary?.total_count ?? 0;
  const shares = data.shares?.count ?? 0;
  const impressions = data.impressions ?? 0;
  const reach = data.reach ?? 0;
  const engagement = likes + comments + shares;
  const engagement_rate = reach > 0 ? engagement / reach : 0;

  return {
    likes,
    comments,
    shares,
    saves: 0,
    reach,
    impressions,
    clicks: 0,
    engagement_rate,
  };
}

export async function scheduleMetricsFetchForPost(
  postId: string
): Promise<void> {
  const queue = createMetricsFetchQueue();

  const fetchTimes = [
    { delay: 6 * 60 * 60 * 1000, label: "6h" },
    { delay: 24 * 60 * 60 * 1000, label: "24h" },
    { delay: 72 * 60 * 60 * 1000, label: "72h" },
  ];

  for (const { delay, label } of fetchTimes) {
    await queue.add(
      `metrics-${postId}-${label}`,
      { postId },
      {
        delay,
        jobId: `metrics-${postId}-${label}`,
        removeOnComplete: true,
      }
    );
  }

  await queue.add(
    `metrics-recurring-${postId}`,
    { postId },
    {
      repeat: {
        every: 6 * 60 * 60 * 1000,
      },
      jobId: `metrics-recurring-${postId}`,
      removeOnComplete: true,
    }
  );

  await queue.close();
}

export async function scheduleMetricsCron(): Promise<void> {
  const interval = 6 * 60 * 60 * 1000;

  const run = async () => {
    console.log("[MetricsCron] Scanning for published posts needing metrics...");

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: {
        status: "published",
        platform_post_id: { not: null },
        published_at: { gte: sixtyDaysAgo },
      },
      select: { id: true, platform_post_id: true, published_at: true },
    });

    const queue = createMetricsFetchQueue();
    let scheduled = 0;

    for (const post of posts) {
      const latestMetric = await prisma.postMetrics.findFirst({
        where: { post_id: post.id },
        orderBy: { fetched_at: "desc" },
        select: { fetched_at: true },
      });

      const needsFetch =
        !latestMetric ||
        Date.now() - latestMetric.fetched_at.getTime() > 6 * 60 * 60 * 1000;

      if (needsFetch) {
        await queue.add(
          `metrics-cron-${post.id}`,
          { postId: post.id },
          {
            jobId: `metrics-cron-${post.id}-${Date.now()}`,
            removeOnComplete: true,
          }
        );
        scheduled++;
      }
    }

    await queue.close();
    console.log(`[MetricsCron] Scheduled ${scheduled} metrics fetches for ${posts.length} published posts`);
  };

  run();
  setInterval(run, interval);
}
