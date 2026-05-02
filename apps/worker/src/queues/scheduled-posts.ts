import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { publishPost } from "../services/publisher";
import { scheduleMetricsFetchForPost } from "./metrics-fetch";
import { notifyPostPublished, notifyPostFailed } from "../services/email";

export const SCHEDULED_POSTS_QUEUE = "scheduled-posts";

export function createScheduledPostsQueue(): Queue {
  return new Queue(SCHEDULED_POSTS_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

export async function startScheduledPostsWorker(): Promise<Worker> {
  const worker = new Worker(
    SCHEDULED_POSTS_QUEUE,
    async (job: Job) => {
      console.log(`[PublisherWorker] Processing job ${job.id} for post ${job.data.postId}`);
      await job.updateProgress(10);
      const result = await processPublishJob(job.data, job);
      await job.updateProgress(100);
      return result;
    },
    {
      connection: redis,
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[PublisherWorker] Job ${job.id} completed — post published`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[PublisherWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[PublisherWorker] Job ${job.id} progress: ${progress}%`);
  });

  return worker;
}

async function processPublishJob(
  data: Record<string, unknown>,
  job: Job
): Promise<unknown> {
  const { postId, platform } = data as {
    postId: string;
    platform: string;
  };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      assets: true,
      campaign: {
        include: {
          workspace: {
            include: {
              platform_connections: {
                where: { platform },
              },
            },
          },
        },
      },
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  if (post.status !== "scheduled" && post.status !== "publishing") {
    console.warn(`[PublisherWorker] Post ${postId} is in status ${post.status}, skipping`);
    return { skipped: true, status: post.status };
  }

  const connection = post.campaign.workspace.platform_connections[0];
  if (!connection) {
    throw new Error(`No ${platform} connection found for workspace`);
  }

  await job.updateProgress(30);

  try {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "publishing" },
    });

    await job.updateProgress(50);

    const assetUrls = post.assets.map((a) => a.url);

    const result = await publishPost({
      postId: post.id,
      platform: post.platform as "instagram" | "facebook",
      caption: post.caption,
      hashtags: post.hashtags,
      cta: post.cta || undefined,
      assetUrls,
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token || undefined,
      platformUserId: connection.platform_user_id || undefined,
      scheduledAt: post.scheduled_at?.toISOString() || new Date().toISOString(),
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: "published",
        platform_post_id: result.platform_post_id,
        published_at: new Date(),
        error: null,
      },
    });

    await prisma.scheduleJob.updateMany({
      where: { post_id: postId, status: "pending" },
      data: {
        status: "completed",
        bullmq_job_id: job.id?.toString(),
        updated_at: new Date(),
      },
    });

    await job.updateProgress(100);
    console.log(`[PublisherWorker] Post ${postId} published successfully — ID: ${result.platform_post_id}`);

    await scheduleMetricsFetchForPost(postId);
    console.log(`[PublisherWorker] Metrics fetch scheduled for post ${postId}`);

    const owner = await prisma.workspaceMember.findFirst({
      where: { workspace_id: post.campaign.workspace_id, role: "owner" },
      include: { user: { select: { email: true } } },
    });
    if (owner?.user.email) {
      await notifyPostPublished(owner.user.email, {
        platform: post.platform,
        caption: post.caption,
        publishedAt: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: "failed",
        error: errorMessage,
      },
    });

    await prisma.scheduleJob.updateMany({
      where: { post_id: postId, status: "pending" },
      data: {
        status: "failed",
        last_error: errorMessage,
        attempts: { increment: 1 },
        updated_at: new Date(),
      },
    });

    const owner = await prisma.workspaceMember.findFirst({
      where: { workspace_id: post.campaign.workspace_id, role: "owner" },
      include: { user: { select: { email: true } } },
    });
    if (owner?.user.email) {
      await notifyPostFailed(owner.user.email, {
        platform: post.platform,
        caption: post.caption,
        error: errorMessage,
        retryUrl: `${process.env.NEXTAUTH_URL}/dashboard/schedule`,
      });
    }

    throw error;
  }
}

export async function schedulePostForPublishing(
  postId: string,
  scheduledAt: Date
): Promise<Job> {
  const queue = createScheduledPostsQueue();
  const job = await queue.add(
    `publish-${postId}`,
    { postId },
    {
      delay: scheduledAt.getTime() - Date.now(),
      jobId: `publish-${postId}`,
      removeOnComplete: true,
    }
  );

  await prisma.scheduleJob.create({
    data: {
      post_id: postId,
      bullmq_job_id: job.id?.toString(),
      scheduled_at: scheduledAt,
      status: "pending",
    },
  });

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: "scheduled",
      scheduled_at: scheduledAt,
    },
  });

  await queue.close();
  return job;
}
