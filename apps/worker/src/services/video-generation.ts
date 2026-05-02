import { generateTTS } from "./tts";
import { composeVideo, type VideoResult, type VideoCompositionOptions } from "./video-composer";
import { getTemplateById } from "./video-templates/registry";
import type { BrandConfig } from "../../../../packages/shared/src";

export type VideoGenerationOptions = {
  text: string;
  backgroundImageBuffer: Buffer;
  templateId?: string;
  brandConfig?: BrandConfig;
  platform: string;
};

const PLATFORM_VIDEO_SETTINGS: Record<string, { aspectRatio: string; maxDuration: number }> = {
  instagram: { aspectRatio: "9:16", maxDuration: 90 },
  tiktok: { aspectRatio: "9:16", maxDuration: 180 },
  facebook: { aspectRatio: "16:9", maxDuration: 240 },
  twitter: { aspectRatio: "16:9", maxDuration: 140 },
  linkedin: { aspectRatio: "16:9", maxDuration: 600 },
  pinterest: { aspectRatio: "4:5", maxDuration: 30 },
};

export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoResult> {
  const {
    text,
    backgroundImageBuffer,
    templateId = "quote-card",
    brandConfig,
    platform,
  } = options;

  const template = getTemplateById(templateId);
  const platformSettings = PLATFORM_VIDEO_SETTINGS[platform] || {
    aspectRatio: "9:16",
    maxDuration: 60,
  };

  const tone = brandConfig?.tone || "professional";

  const ttsBuffer = await generateTTS({
    text,
    tone,
    speed: 1.0,
  });

  const dimensions = getDimensionsForRatio(platformSettings.aspectRatio);

  const compositionOptions: VideoCompositionOptions = {
    backgroundImageBuffer,
    audioBuffer: ttsBuffer,
    textOverlay: text,
    textPosition: templateId === "hook-reveal" ? "bottom" : "center",
    width: dimensions.width,
    height: dimensions.height,
    format: "mp4",
  };

  const videoResult = await composeVideo(compositionOptions);

  return videoResult;
}

function getDimensionsForRatio(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    default:
      return { width: 1080, height: 1920 };
  }
}
