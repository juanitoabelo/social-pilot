export { Queue } from "bullmq";
export type { QueueOptions } from "bullmq";
export { default as Redis } from "ioredis";
import { Queue as BullMQQueue } from "bullmq";
import IORedis from "ioredis";

export type Platform = "instagram" | "facebook" | "twitter" | "tiktok" | "linkedin" | "pinterest";

export type WorkspaceRole = "owner" | "admin" | "member";

export type CampaignStatus = "draft" | "generating" | "ready" | "archived";

export type PostStatus =
  | "pending_review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface BrandConfig {
  brand_name: string;
  tone: "professional" | "casual" | "humorous" | "inspirational" | "educational";
  do: string[];
  dont: string[];
  hashtag_style: "lowercase" | "camelcase" | "none";
  emoji_policy: "required" | "optional" | "none";
  visual_style?: string;
}

export interface AudienceConfig {
  age_groups?: string[];
  interests?: string[];
  location?: string;
}

export interface PLATFORM_DIMENSIONS {
  [key: string]: {
    feed?: {
      width: number;
      height: number;
      aspectRatio: string;
    };
    story?: {
      width: number;
      height: number;
      aspectRatio: string;
    };
    video?: {
      width: number;
      height: number;
      aspectRatio: string;
    };
    pin?: {
      width: number;
      height: number;
      aspectRatio: string;
    };
  };
}

export const PLATFORM_DIMENSIONS: PLATFORM_DIMENSIONS = {
  instagram: {
    feed: { width: 1080, height: 1080, aspectRatio: "1:1" },
    story: { width: 1080, height: 1920, aspectRatio: "9:16" },
  },
  facebook: {
    feed: { width: 1200, height: 630, aspectRatio: "1.91:1" },
    story: { width: 1080, height: 1920, aspectRatio: "9:16" },
  },
  twitter: {
    feed: { width: 1200, height: 675, aspectRatio: "16:9" },
  },
  linkedin: {
    feed: { width: 1200, height: 627, aspectRatio: "1.91:1" },
  },
  tiktok: {
    video: { width: 1080, height: 1920, aspectRatio: "9:16" },
  },
  pinterest: {
    pin: { width: 1000, height: 1500, aspectRatio: "2:3" },
  },
};

export const PLATFORM_LIMITS: Record<Platform, { caption: number }> = {
  instagram: { caption: 2200 },
  facebook: { caption: 63206 },
  twitter: { caption: 280 },
  tiktok: { caption: 2200 },
  linkedin: { caption: 3000 },
  pinterest: { caption: 500 },
};

export interface PublishResult {
  platform_post_id: string;
  url?: string;
}

export interface PublishPayload {
  postId: string;
  platform: Platform;
  caption: string;
  hashtags: string[];
  cta?: string;
  assetUrls: string[];
  accessToken: string;
  refreshToken?: string;
  platformUserId?: string;
  scheduledAt: string;
}

export interface PlatformAdapter {
  publish(payload: PublishPayload): Promise<PublishResult>;
  validateToken(accessToken: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }>;
}

export function formatApiResponse<T>(data: T, error: null): { data: T; error: null };
export function formatApiResponse<T>(data: null, error: { code: string; message: string }): { data: null; error: { code: string; message: string } };
export function formatApiResponse<T>(data: T | null, error: { code: string; message: string } | null) {
  return { data, error };
}

let _redis: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379");
  }
  return _redis;
}

export function createQueue(name: string): BullMQQueue {
  return new BullMQQueue(name, {
    connection: {
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },
  });
}
