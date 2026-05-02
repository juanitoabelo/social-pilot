import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { encrypt, decrypt } from "../lib/crypto";
import { AuthError } from "../lib/errors";

export const TOKEN_REFRESH_QUEUE = "token-refresh";

export function createTokenRefreshQueue(): Queue {
  return new Queue(TOKEN_REFRESH_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 300000,
      },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

export async function startTokenRefreshWorker(): Promise<Worker> {
  const worker = new Worker(
    TOKEN_REFRESH_QUEUE,
    async (job: Job) => {
      console.log(`[TokenRefresh] Processing job ${job.id}`);
      return processTokenRefreshJob(job.data, job);
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[TokenRefresh] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[TokenRefresh] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function processTokenRefreshJob(
  data: Record<string, unknown>,
  _job: Job
): Promise<unknown> {
  const { connectionId } = data as { connectionId: string };

  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return { skipped: true, reason: "connection not found" };
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("ENCRYPTION_KEY is not set");

  try {
    const decryptedToken = decrypt(connection.access_token, encryptionKey);

    const refreshed = await refreshMetaToken(decryptedToken);

    const encryptedToken = encrypt(refreshed.accessToken, encryptionKey);

    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        access_token: encryptedToken,
        refresh_token: refreshed.refreshToken ?? connection.refresh_token,
        updated_at: new Date(),
      },
    });

    console.log(`[TokenRefresh] Token refreshed for ${connection.platform} (${connection.platform_username})`);
    return { refreshed: true, platform: connection.platform };
  } catch (error) {
    console.error(
      `[TokenRefresh] Failed to refresh token for ${connection.platform}:`,
      error
    );

    if (error instanceof AuthError) {
      console.warn(
        `[TokenRefresh] Permanent auth failure for ${connection.platform} - user needs to reconnect`
      );
    }

    throw error;
  }
}

async function refreshMetaToken(
  currentToken: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: currentToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params}`
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "Token refresh failed — token may be revoked. User needs to reconnect."
      );
    }

    throw new Error(
      `Token refresh failed: ${response.status} ${JSON.stringify(errorBody)}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: undefined,
  };
}

export async function scheduleTokenRefreshChecks(): Promise<void> {
  const queue = createTokenRefreshQueue();

  const connections = await prisma.platformConnection.findMany({
    where: {
      platform: { in: ["instagram", "facebook"] },
    },
    select: { id: true, platform: true, updated_at: true },
  });

  for (const connection of connections) {
    const lastRefresh = new Date(connection.updated_at).getTime();
    const sixHours = 6 * 60 * 60 * 1000;
    const nextRefresh = lastRefresh + sixHours;
    const delay = Math.max(0, nextRefresh - Date.now());

    await queue.add(
      `refresh-${connection.id}`,
      { connectionId: connection.id },
      {
        delay,
        jobId: `refresh-${connection.id}`,
        removeOnComplete: true,
      }
    );
  }

  await queue.add(
    "recurring-refresh",
    {},
    {
      repeat: {
        every: 6 * 60 * 60 * 1000,
      },
      jobId: "recurring-refresh",
      removeOnComplete: true,
    }
  );

  await queue.close();
}
