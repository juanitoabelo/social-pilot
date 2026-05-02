import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendWeeklyDigest, notifyPlanLimit } from "../services/email";

export const NOTIFICATIONS_QUEUE = "notifications";

export function createNotificationsQueue(): Queue {
  return new Queue(NOTIFICATIONS_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 60000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

export async function startNotificationsWorker(): Promise<Worker> {
  const worker = new Worker(
    NOTIFICATIONS_QUEUE,
    async (job: Job) => {
      console.log(`[NotificationsWorker] Processing job ${job.id} type: ${job.name}`);
      return processNotificationJob(job);
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[NotificationsWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[NotificationsWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function processNotificationJob(job: Job): Promise<unknown> {
  const { type, workspaceId } = job.data as { type: string; workspaceId: string };

  if (type === "weekly-digest") {
    return sendWeeklyDigestNotification(workspaceId);
  }

  if (type === "plan-limit-check") {
    return checkPlanLimit(workspaceId);
  }

  return { skipped: true, reason: "unknown notification type" };
}

async function sendWeeklyDigestNotification(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: { user: { select: { email: true } } },
        where: { role: "owner" },
      },
    },
  });

  if (!workspace || workspace.members.length === 0) {
    return { skipped: true, reason: "workspace or owner not found" };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    where: {
      campaign: { workspace_id: workspaceId },
      status: "published",
      published_at: { gte: sevenDaysAgo },
    },
    select: {
      platform: true,
      caption: true,
      metrics: {
        orderBy: { fetched_at: "desc" },
        take: 1,
        select: { engagement_rate: true, reach: true },
      },
    },
  });

  if (posts.length === 0) {
    return { skipped: true, reason: "no posts this week" };
  }

  let totalEngagement = 0;
  let totalReach = 0;
  let engagementCount = 0;
  const platformCounts: Record<string, number> = {};
  const topPosts: Array<{ caption: string; platform: string; engagement: number }> = [];

  for (const post of posts) {
    const metric = post.metrics[0];
    if (metric) {
      totalEngagement += metric.reach * metric.engagement_rate;
      totalReach += metric.reach;
      engagementCount++;
      topPosts.push({
        caption: post.caption,
        platform: post.platform,
        engagement: metric.engagement_rate,
      });
    }
    platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
  }

  const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

  topPosts.sort((a, b) => b.engagement - a.engagement);

  const now = new Date();
  const weekStart = sevenDaysAgo;
  const weekRange = `${weekStart.toLocaleDateString()} – ${now.toLocaleDateString()}`;

  const userEmail = workspace.members[0].user.email;

  await sendWeeklyDigest(userEmail, workspace.name, {
    weekRange,
    totalPosts: posts.length,
    avgEngagement: engagementCount > 0 ? totalEngagement / totalReach : 0,
    totalReach,
    topPlatform,
    topPosts: topPosts.slice(0, 5),
  });

  return { sent: true, to: userEmail, type: "weekly-digest" };
}

async function checkPlanLimit(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: { user: { select: { email: true } } },
        where: { role: "owner" },
      },
    },
  });

  if (!workspace || workspace.members.length === 0) {
    return { skipped: true, reason: "workspace or owner not found" };
  }

  const limits = {
    free: 10,
    solo: 100,
    team: 500,
    agency: 999999,
  };

  const plan = workspace.subscription_plan as keyof typeof limits;
  const limit = limits[plan] || limits.free;
  const usagePercent = (workspace.ai_generations_this_month / limit) * 100;

  if (usagePercent < 80) {
    return { skipped: true, reason: "usage below 80% threshold" };
  }

  if (plan === "agency") {
    return { skipped: true, reason: "agency plan has unlimited generations" };
  }

  const userEmail = workspace.members[0].user.email;

  await notifyPlanLimit(userEmail, {
    planName: plan,
    generationsUsed: workspace.ai_generations_this_month,
    generationsLimit: limit,
    upgradeUrl: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
  });

  return { sent: true, to: userEmail, type: "plan-limit", usagePercent };
}

export async function scheduleWeeklyDigests(): Promise<void> {
  const queue = createNotificationsQueue();

  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
  });

  for (const ws of workspaces) {
    await queue.add(
      `weekly-digest-${ws.id}`,
      { type: "weekly-digest", workspaceId: ws.id },
      {
        repeat: { pattern: "0 9 * * 1" },
        jobId: `weekly-digest-${ws.id}`,
        removeOnComplete: true,
      }
    );
  }

  await queue.close();
  console.log(`[NotificationsWorker] Weekly digests scheduled for ${workspaces.length} workspaces`);
}

export async function schedulePlanLimitChecks(): Promise<void> {
  const queue = createNotificationsQueue();
  const interval = 24 * 60 * 60 * 1000;

  const run = async () => {
    const workspaces = await prisma.workspace.findMany({
      where: { subscription_plan: { not: "agency" } },
      select: { id: true },
    });

    for (const ws of workspaces) {
      await queue.add(
        `plan-limit-${ws.id}-${Date.now()}`,
        { type: "plan-limit-check", workspaceId: ws.id },
        { jobId: `plan-limit-${ws.id}`, removeOnComplete: true }
      );
    }

    await queue.close();
  };

  run();
  setInterval(run, interval);
}
