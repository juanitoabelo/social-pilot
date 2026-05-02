import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

export type VideoCompositionOptions = {
  backgroundImageUrl?: string;
  backgroundImageBuffer?: Buffer;
  audioBuffer?: Buffer;
  textOverlay?: string;
  textPosition?: "center" | "bottom" | "top";
  duration?: number;
  width?: number;
  height?: number;
  format?: "mp4" | "webm";
};

export type VideoResult = {
  buffer: Buffer;
  duration: number;
  width: number;
  height: number;
  format: string;
};

const DEFAULT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export async function composeVideo(
  options: VideoCompositionOptions
): Promise<VideoResult> {
  const {
    backgroundImageUrl,
    backgroundImageBuffer,
    audioBuffer,
    textOverlay,
    textPosition = "bottom",
    width = 1080,
    height = 1920,
    format = "mp4",
  } = options;

  const tempDir = tmpdir();
  const jobId = randomUUID();
  const outputExt = format === "webm" ? "webm" : "mp4";
  const outputFile = join(tempDir, `${jobId}-output.${outputExt}`);

  let imageInputPath: string | null = null;
  let audioInputPath: string | null = null;

  const imageExt = "jpg";
  imageInputPath = join(tempDir, `${jobId}-bg.${imageExt}`);

  if (backgroundImageBuffer) {
    await require("fs/promises").writeFile(imageInputPath, backgroundImageBuffer);
  } else if (backgroundImageUrl) {
    const response = await fetch(backgroundImageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    await require("fs/promises").writeFile(imageInputPath, buffer);
  }

  if (!imageInputPath) {
    throw new Error("Either backgroundImageUrl or backgroundImageBuffer is required");
  }

  let audioDuration = options.duration || 5;

  if (audioBuffer) {
    audioInputPath = join(tempDir, `${jobId}-audio.mp3`);
    await require("fs/promises").writeFile(audioInputPath, audioBuffer);

    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      audioInputPath,
    ]);
    audioDuration = parseFloat(stdout.trim()) || audioDuration;
  }

  const ffmpegArgs: string[] = [
    "-loop", "1",
    "-i", imageInputPath,
    "-f", "lavfi",
    "-i", `color=c=black:s=${width}x${height}:d=${audioDuration}`,
    "-filter_complex", buildFilterComplex(width, height, textOverlay, textPosition, audioDuration),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-t", String(audioDuration),
  ];

  if (audioInputPath) {
    ffmpegArgs.push("-i", audioInputPath, "-c:a", "aac", "-b:a", "128k", "-shortest");
  }

  ffmpegArgs.push("-y", outputFile);

  try {
    await execFileAsync("ffmpeg", ffmpegArgs);
  } catch (error) {
    throw new Error(`FFmpeg video composition failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  const outputBuffer = await require("fs/promises").readFile(outputFile);
  const stat = await require("fs/promises").stat(outputFile);

  const cleanup = async () => {
    try {
      await require("fs/promises").unlink(imageInputPath!);
      if (audioInputPath) await require("fs/promises").unlink(audioInputPath);
      await require("fs/promises").unlink(outputFile);
    } catch {
    }
  };
  await cleanup();

  return {
    buffer: outputBuffer,
    duration: audioDuration,
    width,
    height,
    format: outputExt,
  };
}

function buildFilterComplex(
  width: number,
  height: number,
  textOverlay?: string,
  textPosition?: string,
  duration?: number
): string {
  const filters: string[] = [];

  filters.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease, pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black[bg]`);

  if (textOverlay) {
    const fontSize = Math.floor(width / 18);
    const boxPadding = Math.floor(width / 40);
    const boxMargin = Math.floor(height / 20);

    let yPosition: string;
    switch (textPosition) {
      case "top":
        yPosition = String(boxMargin);
        break;
      case "center":
        yPosition = `(h-text_h)/2`;
        break;
      case "bottom":
      default:
        yPosition = `h-${boxMargin}-text_h`;
        break;
    }

    const escapedText = textOverlay
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:")
      .replace(/,/g, "\\,");

    filters.push(
      `[bg]drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=black@0.5:boxborderw=${boxPadding}:enable='between(t,1,${(duration || 5) - 1})'[out]`
    );
  } else {
    filters.push(`[bg]null[out]`);
  }

  return filters.join(";");
}

export async function getDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

export async function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    filePath,
  ]);
  const [width, height] = stdout.trim().split(",").map(Number);
  return { width, height };
}
