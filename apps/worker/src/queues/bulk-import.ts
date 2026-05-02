import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { uploadToS3 } from "../services/s3-upload";

export const BULK_IMPORT_QUEUE = "bulk-import";

export function createBulkImportQueue(): Queue {
  return new Queue(BULK_IMPORT_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

export async function startBulkImportWorker(): Promise<Worker> {
  const worker = new Worker(
    BULK_IMPORT_QUEUE,
    async (job: Job) => {
      console.log(`[BulkImportWorker] Processing job ${job.id}`);
      await job.updateProgress(5);
      const result = await processBulkImport(job.data, job);
      await job.updateProgress(100);
      return result;
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    const result = job.returnvalue as { created?: number } | undefined;
    console.log(`[BulkImportWorker] Job ${job.id} completed — ${result?.created || 0} posts created`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[BulkImportWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

type ColumnMapping = Record<string, string | null>;

async function processBulkImport(
  data: Record<string, unknown>,
  job: Job
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const {
    workspaceId,
    userId,
    rows,
    columnMapping,
    defaultPlatform,
    scheduleMode,
  } = data as {
    workspaceId: string;
    userId: string;
    rows: Array<{ row: Record<string, string>; rowIndex: number }>;
    columnMapping: ColumnMapping;
    defaultPlatform: string;
    scheduleMode: string;
  };

  const created: number[] = [];
  const skipped: number[] = [];
  const errors: string[] = [];
  const VALID_PLATFORMS = ["instagram", "facebook", "twitter", "tiktok", "linkedin", "pinterest"];

  console.log(`[BulkImportWorker] Processing ${rows.length} rows for workspace ${workspaceId}`);

  for (let i = 0; i < rows.length; i++) {
    const { row, rowIndex } = rows[i];
    const progress = 10 + Math.floor((i / rows.length) * 80);
    await job.updateProgress(progress);

    try {
      const caption = columnMapping.caption ? row[columnMapping.caption]?.trim() : "";
      if (!caption) {
        skipped.push(rowIndex);
        continue;
      }

      let platform = defaultPlatform;
      if (columnMapping.platform && row[columnMapping.platform]) {
        const raw = row[columnMapping.platform].toLowerCase().trim();
        if (raw.includes("instagram") || raw.includes("ig")) platform = "instagram";
        else if (raw.includes("facebook") || raw.includes("fb")) platform = "facebook";
        else if (raw.includes("twitter") || raw.includes("x ")) platform = "twitter";
        else if (raw.includes("tiktok") || raw.includes("tt")) platform = "tiktok";
        else if (raw.includes("linkedin") || raw.includes("li")) platform = "linkedin";
        else if (raw.includes("pinterest") || raw.includes("pin")) platform = "pinterest";
      }

      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push(`Row ${rowIndex}: Invalid platform "${row[columnMapping.platform!]}" — skipping`);
        skipped.push(rowIndex);
        continue;
      }

      let hashtags: string[] = [];
      if (columnMapping.hashtags && row[columnMapping.hashtags]) {
        hashtags = row[columnMapping.hashtags]
          .split(/\s+/)
          .filter((t: string) => t.length > 0)
          .map((t: string) => t.startsWith("#") ? t : `#${t}`);
      }

      let scheduledAt: Date | null = null;
      if (columnMapping.date && row[columnMapping.date]) {
        const dateStr = row[columnMapping.date];
        const timeStr = columnMapping.time ? row[columnMapping.time] || "09:00" : "09:00";

        const parsedDate = parseDate(dateStr, timeStr);
        if (parsedDate) {
          scheduledAt = parsedDate;
        }
      }

      const status = scheduleMode === "scheduled" && scheduledAt
        ? "scheduled"
        : scheduleMode === "draft"
          ? "pending_review"
          : "pending_review";

      const post = await prisma.post.create({
        data: {
          campaign_id: await getOrCreateImportCampaign(workspaceId, userId, `Sheet Import ${new Date().toLocaleDateString()}`),
          platform,
          caption,
          hashtags,
          cta: null,
          status,
          scheduled_at: scheduledAt,
        },
      });

      if (columnMapping.media_url && row[columnMapping.media_url]) {
        const mediaUrl = row[columnMapping.media_url].trim();
        if (mediaUrl.startsWith("http")) {
          try {
            const response = await fetch(mediaUrl);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              const contentType = response.headers.get("content-type") || "image/jpeg";
              const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
              const timestamp = Date.now();
              const key = `${workspaceId}/bulk-import/${post.id}_${timestamp}.${ext}`;

              const { s3Key, url } = await uploadToS3({
                key,
                buffer,
                contentType,
              });

              await prisma.asset.create({
                data: {
                  post_id: post.id,
                  type: contentType.startsWith("video") ? "video" : "image",
                  s3_key: s3Key,
                  url,
                  format: ext,
                  width: null,
                  height: null,
                  size_bytes: buffer.length,
                  alt_text: null,
                },
              });
            }
          } catch (mediaErr) {
            console.warn(`[BulkImportWorker] Failed to download media for row ${rowIndex}:`, mediaErr);
          }
        }
      }

      created.push(rowIndex);
    } catch (err) {
      errors.push(`Row ${rowIndex}: ${err instanceof Error ? err.message : "Unknown error"}`);
      skipped.push(rowIndex);
    }
  }

  console.log(`[BulkImportWorker] Complete — ${created.length} created, ${skipped.length} skipped, ${errors.length} errors`);

  return { created: created.length, skipped: skipped.length, errors };
}

async function getOrCreateImportCampaign(
  workspaceId: string,
  userId: string,
  title: string
): Promise<string> {
  const existing = await prisma.campaign.findFirst({
    where: {
      workspace_id: workspaceId,
      title,
    },
    orderBy: { created_at: "desc" },
  });

  if (existing) return existing.id;

  const campaign = await prisma.campaign.create({
    data: {
      workspace_id: workspaceId,
      title,
      brief: "Imported from Google Sheets",
      audience: {},
      platforms: ["instagram", "facebook", "twitter", "tiktok", "linkedin", "pinterest"],
      status: "ready",
      variant_count: 1,
      generate_video: false,
      created_by: userId,
    },
  });

  return campaign.id;
}

function parseDate(dateStr: string, timeStr: string): Date | null {
  try {
    let parsed: Date;

    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const [hours = "09", minutes = "00"] = timeStr.split(":");
      parsed = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`);
    } else {
      const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usMatch) {
        const [, month, day, year] = usMatch;
        const [hours = "09", minutes = "00"] = timeStr.split(":");
        parsed = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`);
      } else {
        parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return null;
        const [hours = "09", minutes = "00"] = timeStr.split(":");
        parsed.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }
    }

    if (isNaN(parsed.getTime())) return null;
    if (parsed < new Date()) return null;

    return parsed;
  } catch {
    return null;
  }
}
