import sharp from "sharp";
import { PLATFORM_DIMENSIONS } from "../../../../packages/shared/src";

export interface ImageVariant {
  width: number;
  height: number;
  buffer: Buffer;
  format: "jpg" | "png" | "webp";
}

export async function resizeImage(params: {
  imageBuffer: Buffer;
  platform: string;
  type?: "feed" | "story";
}): Promise<ImageVariant[]> {
  const dims = (PLATFORM_DIMENSIONS as Record<string, { feed?: { width: number; height: number } }>)[params.platform];
  const feedDim = dims?.feed;

  if (!feedDim) {
    return [{
      width: 1080,
      height: 1080,
      buffer: await sharp(params.imageBuffer).resize(1080, 1080, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer(),
      format: "jpg",
    }];
  }

  const variants: ImageVariant[] = [];

  const resized = await sharp(params.imageBuffer)
    .resize(feedDim.width, feedDim.height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  variants.push({
    width: feedDim.width,
    height: feedDim.height,
    buffer: resized,
    format: "jpg",
  });

  return variants;
}
