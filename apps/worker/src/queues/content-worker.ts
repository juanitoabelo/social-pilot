import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { generateCopy, generateImagePrompt } from "../services/copy-generation";
import { generateImage } from "../services/image-generation";
import { resizeImage } from "../services/image-processor";
import { uploadToS3 } from "../services/s3-upload";

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
  const { campaignId, workspaceId, brief, platforms, brandConfig, audience } = data as {
    campaignId: string;
    workspaceId: string;
    brief: string;
    platforms: string[];
    brandConfig: Record<string, unknown>;
    audience: Record<string, unknown>;
  };
  
  console.log(`[ContentWorker] Generating content for campaign ${campaignId}`);
  console.log(`  Platforms: ${platforms?.join(", ")}`);
  
  try {
    // Update campaign status to generating
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "generating" },
    });
    
    await job.updateProgress(20);
    
    // Generate content for each platform
    for (const platform of platforms) {
      const platformProgress = 20 + (platforms.indexOf(platform) * 60 / platforms.length);
      await job.updateProgress(platformProgress);
      
      console.log(`  Generating content for ${platform}...`);
      
      // Step 1: Generate copy using Claude
      const copyResult = await generateCopy({
        brief,
        platform,
        audience,
        brandConfig,
      });
      
      console.log(`  Copy generated for ${platform} (${copyResult.caption.length} chars)`);
      await job.updateProgress(platformProgress + 15);
      
      // Step 2: Generate DALL-E 3 prompt using Claude
      const imagePrompt = await generateImagePrompt({
        caption: copyResult.caption,
        imageHint: copyResult.image_prompt_hint,
        brandConfig,
        platform,
      });
      
      console.log(`  Image prompt generated for ${platform}`);
      await job.updateProgress(platformProgress + 25);
      
      // Step 3: Generate image using DALL-E 3
      const imageResult = await generateImage({
        prompt: imagePrompt,
      });
      
      console.log(`  Image generated for ${platform}`);
      await job.updateProgress(platformProgress + 35);
      
      // Step 4: Decode base64 image to buffer
      const imageBuffer = Buffer.from(imageResult.b64_json ?? "", "base64");
      
      // Step 5: Resize image to platform-specific dimensions
      const variants = await resizeImage({
        imageBuffer,
        platform,
      });
      
      console.log(`  Image resized for ${platform} (${variants.length} variant(s))`);
      await job.updateProgress(platformProgress + 45);
      
      // Step 6: Upload to S3
      const timestamp = Date.now();
      const uploadPromises = variants.map(async (variant, idx) => {
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
      
      // Step 7: Create post record
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
      
      // Step 8: Create asset records for each variant
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
      
      console.log(`  Post and assets created for ${platform}`);
      await job.updateProgress(platformProgress + 60);
    }
    
    // Update campaign status to ready
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "ready" },
    });
    
    console.log(`[ContentWorker] Campaign ${campaignId} completed - status: ready`);
    return { campaignId, status: "ready", platforms };
  } catch (error) {
    console.error("[ContentWorker] Error generating content:", error);
    
    // Update campaign status back to draft on failure
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "draft" },
    });
    
    throw error;
  }
}