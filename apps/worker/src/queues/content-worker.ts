import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { generateCopy, generateImagePrompt, generateVariants } from "../services/copy-generation";
import { generateImage } from "../services/image-generation";
import { resizeImage } from "../services/image-processor";
import { uploadToS3 } from "../services/s3-upload";
import { buildPerformanceContext } from "../services/performance-context";
import { generateVideo } from "../services/video-generation";

const VIDEO_PLATFORMS = ["instagram", "tiktok", "facebook", "twitter", "linkedin", "pinterest"];

function isVideoPlatform(platform: string): boolean {
  return VIDEO_PLATFORMS.includes(platform);
}

export const CONTENT_QUEUE = "content-generation";

export function createContentQueue(): Queue {
  return new Queue(CONTENT_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

export async function startContentWorker(): Promise<Worker> {
  const worker = new Worker(
    CONTENT_QUEUE,
    async (job: Job) => {
      console.log(`[ContentWorker] Processing job ${job.id} for campaign ${job.data.campaignId}`);
      await job.updateProgress(10);
      const result = await processContentJob(job.data, job);
      await job.updateProgress(100);
      return result;
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );
  
  worker.on("completed", (job) => {
    console.log(`[ContentWorker] Job ${job.id} completed`);
  });
  
  worker.on("failed", (job, err) => {
    console.error(`[ContentWorker] Job ${job?.id} failed:`, err.message);
  });
  
  worker.on("progress", (job, progress) => {
    console.log(`[ContentWorker] Job ${job.id} progress: ${progress}%`);
  });
  
  return worker;
}

async function processContentJob(data: Record<string, unknown>, job: Job): Promise<unknown> {
  const { campaignId, workspaceId, brief, platforms, brandConfig, audience, variantCount, generateVideo: shouldGenerateVideo } = data as {
    campaignId: string;
    workspaceId: string;
    brief: string;
    platforms: string[];
    brandConfig: Record<string, unknown>;
    audience: Record<string, unknown>;
    variantCount: number;
    generateVideo: boolean;
  };

  console.log(`[ContentWorker] Generating content for campaign ${campaignId}`);
  console.log(`  Platforms: ${platforms?.join(", ")}`);
  console.log(`  Variants: ${variantCount || 1}`);

  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "generating" },
    });

    await job.updateProgress(20);

    const performanceContext = await buildPerformanceContext(workspaceId);
    if (performanceContext) {
      console.log("  Performance context loaded for AI feedback loop");
    }

    for (const platform of platforms) {
      const platformIndex = platforms.indexOf(platform);
      const platformProgress = 20 + (platformIndex * 60 / platforms.length);
      await job.updateProgress(platformProgress);

      console.log(`  Generating content for ${platform}...`);

      const useVariants = variantCount && variantCount > 1;

      if (useVariants) {
        const variantResults = await generateVariants({
          brief,
          platform,
          audience,
          brandConfig,
          variantCount: Math.min(variantCount, 3),
          ...(performanceContext ? { performanceContext } : {}),
        });

        console.log(`  ${variantResults.length} variants generated for ${platform}`);

        for (const variantResult of variantResults) {
          const imagePrompt = await generateImagePrompt({
            caption: variantResult.caption,
            imageHint: variantResult.image_prompt_hint,
            brandConfig,
            platform,
          });

          const imageResult = await generateImage({ prompt: imagePrompt });
          const imageBuffer = Buffer.from(imageResult.b64_json ?? "", "base64");
          const variants = await resizeImage({ imageBuffer, platform });

          const timestamp = Date.now();
          const key = `${workspaceId}/${campaignId}/${platform}_${variantResult.variant_label}_${timestamp}.jpg`;
          const { s3Key, url } = await uploadToS3({
            key,
            buffer: variants[0].buffer,
            contentType: "image/jpeg",
          });

          const post = await prisma.post.create({
            data: {
              campaign_id: campaignId,
              platform,
              caption: variantResult.caption,
              hashtags: variantResult.hashtags,
              cta: variantResult.cta,
              variant_label: variantResult.variant_label,
              status: "pending_review",
            },
          });

          await prisma.asset.create({
            data: {
              post_id: post.id,
              type: "image",
              s3_key: s3Key,
              url,
              format: variants[0].format,
              width: variants[0].width,
              height: variants[0].height,
              size_bytes: variants[0].buffer.length,
              alt_text: variantResult.alt_text,
            },
          });

          if (shouldGenerateVideo && isVideoPlatform(platform)) {
            try {
              const videoBuffer = await generateVideo({
                text: variantResult.caption,
                backgroundImageBuffer: variants[0].buffer,
                brandConfig: brandConfig as any,
                platform,
              });

              const videoTimestamp = Date.now();
              const videoKey = `${workspaceId}/${campaignId}/${platform}_${variantResult.variant_label}_video_${videoTimestamp}.mp4`;
              const videoUpload = await uploadToS3({
                key: videoKey,
                buffer: videoBuffer.buffer,
                contentType: "video/mp4",
              });

              await prisma.asset.create({
                data: {
                  post_id: post.id,
                  type: "video",
                  s3_key: videoUpload.s3Key,
                  url: videoUpload.url,
                  format: videoBuffer.format,
                  width: videoBuffer.width,
                  height: videoBuffer.height,
                  size_bytes: videoBuffer.buffer.length,
                  alt_text: variantResult.alt_text,
                },
              });
            } catch {
            }
          }
        }
      } else {
        const copyResult = await generateCopy({
          brief,
          platform,
          audience,
          brandConfig,
          ...(performanceContext ? { performanceContext } : {}),
        });

        console.log(`  Copy generated for ${platform} (${copyResult.caption.length} chars)`);
        await job.updateProgress(platformProgress + 15);

        const imagePrompt = await generateImagePrompt({
          caption: copyResult.caption,
          imageHint: copyResult.image_prompt_hint,
          brandConfig,
          platform,
        });

        console.log(`  Image prompt generated for ${platform}`);
        await job.updateProgress(platformProgress + 25);

        const imageResult = await generateImage({ prompt: imagePrompt });
        console.log(`  Image generated for ${platform}`);
        await job.updateProgress(platformProgress + 35);

        const imageBuffer = Buffer.from(imageResult.b64_json ?? "", "base64");
        const resizedVariants = await resizeImage({ imageBuffer, platform });
        console.log(`  Image resized for ${platform} (${resizedVariants.length} variant(s))`);
        await job.updateProgress(platformProgress + 45);

        const timestamp = Date.now();
        const uploadPromises = resizedVariants.map(async (variant, idx) => {
          const key = `${workspaceId}/${campaignId}/${platform}_${idx}_${timestamp}.jpg`;
          const { s3Key, url } = await uploadToS3({
            key,
            buffer: variant.buffer,
            contentType: "image/jpeg",
          });
          return { s3Key, url, variant };
        });

        const uploadedVariants = await Promise.all(uploadPromises);
        console.log(`  Image uploaded to S3 for ${platform}`);
        await job.updateProgress(platformProgress + 55);

        const post = await prisma.post.create({
          data: {
            campaign_id: campaignId,
            platform,
            caption: copyResult.caption,
            hashtags: copyResult.hashtags,
            cta: copyResult.cta,
            status: "pending_review",
          },
        });

        for (const { s3Key, url, variant } of uploadedVariants) {
          await prisma.asset.create({
            data: {
              post_id: post.id,
              type: "image",
              s3_key: s3Key,
              url,
              format: variant.format,
              width: variant.width,
              height: variant.height,
              size_bytes: variant.buffer.length,
              alt_text: copyResult.alt_text,
            },
          });
        }

        if (shouldGenerateVideo && isVideoPlatform(platform)) {
          console.log(`  Generating video for ${platform}...`);
          await job.updateProgress(platformProgress + 50);

          try {
            const videoBuffer = await generateVideo({
              text: copyResult.caption,
              backgroundImageBuffer: resizedVariants[0].buffer,
              brandConfig: brandConfig as any,
              platform,
            });

            const videoTimestamp = Date.now();
            const videoKey = `${workspaceId}/${campaignId}/${platform}_video_${videoTimestamp}.mp4`;
            const videoUpload = await uploadToS3({
              key: videoKey,
              buffer: videoBuffer.buffer,
              contentType: "video/mp4",
            });

            await prisma.asset.create({
              data: {
                post_id: post.id,
                type: "video",
                s3_key: videoUpload.s3Key,
                url: videoUpload.url,
                format: videoBuffer.format,
                width: videoBuffer.width,
                height: videoBuffer.height,
                size_bytes: videoBuffer.buffer.length,
                alt_text: copyResult.alt_text,
              },
            });

            console.log(`  Video generated and uploaded for ${platform}`);
          } catch (videoError) {
            console.warn(`  Video generation failed for ${platform}:`, videoError);
          }
        }

        console.log(`  Post and assets created for ${platform}`);
        await job.updateProgress(platformProgress + 60);
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ready" },
    });

    console.log(`[ContentWorker] Campaign ${campaignId} completed - status: ready`);
    return { campaignId, status: "ready", platforms };
  } catch (error) {
    console.error("[ContentWorker] Error generating content:", error);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "draft" },
    });

    throw error;
  }
}