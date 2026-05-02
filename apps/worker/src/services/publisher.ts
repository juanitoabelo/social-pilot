import {
  PublishPayload,
  PublishResult,
} from "../../../../packages/shared/src";
import { RateLimitError, AuthError } from "../lib/errors";
import { decrypt } from "../lib/crypto";

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set");
  return key;
}

function getDecryptedToken(encryptedToken: string): string {
  try {
    return decrypt(encryptedToken, getEncryptionKey());
  } catch {
    throw new AuthError("Failed to decrypt platform access token");
  }
}

export async function publishPost(payload: PublishPayload): Promise<PublishResult> {
  switch (payload.platform) {
    case "instagram":
      return publishToInstagram(payload);
    case "facebook":
      return publishToFacebook(payload);
    default:
      throw new Error(`Platform ${payload.platform} not yet supported`);
  }
}

async function publishToInstagram(payload: PublishPayload): Promise<PublishResult> {
  const accessToken = getDecryptedToken(payload.accessToken);
  const fullCaption = buildFullCaption(payload.caption, payload.hashtags);

  const mediaUrl = payload.assetUrls[0];
  if (!mediaUrl) {
    throw new Error("No image asset available for Instagram post");
  }

  const igUserId = payload.platformUserId;
  if (!igUserId) {
    throw new Error("Instagram user ID not found in platform connection");
  }

  const mediaContainerId = await createMediaContainer(
    igUserId,
    mediaUrl,
    fullCaption,
    accessToken
  );

  await publishMediaContainer(igUserId, mediaContainerId, accessToken);

  return {
    platform_post_id: mediaContainerId,
    url: `https://www.instagram.com/p/${mediaContainerId}`,
  };
}

async function publishToFacebook(payload: PublishPayload): Promise<PublishResult> {
  const accessToken = getDecryptedToken(payload.accessToken);
  const fullCaption = buildFullCaption(payload.caption, payload.hashtags);

  const mediaUrl = payload.assetUrls[0];
  if (!mediaUrl) {
    throw new Error("No image asset available for Facebook post");
  }

  const pageId = payload.platformUserId;
  if (!pageId) {
    throw new Error("Facebook page ID not found in platform connection");
  }

  const postId = await createFacebookPost(pageId, mediaUrl, fullCaption, accessToken);

  return {
    platform_post_id: postId,
    url: `https://www.facebook.com/${postId}`,
  };
}

function buildFullCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  return tags ? `${caption}\n\n${tags}` : caption;
}

async function createMediaContainer(
  igUserId: string,
  imageUrl: string,
  caption: string,
  accessToken: string
): Promise<string> {
  const url = `https://graph.facebook.com/v18.0/${igUserId}/media`;
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

  const response = await fetch(`${url}?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await parseMetaError(response);
    throw error;
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function publishMediaContainer(
  igUserId: string,
  creationId: string,
  accessToken: string
): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${igUserId}/media_publish`;
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const response = await fetch(`${url}?${params}`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await parseMetaError(response);
    throw error;
  }
}

async function createFacebookPost(
  pageId: string,
  imageUrl: string,
  message: string,
  accessToken: string
): Promise<string> {
  const url = `https://graph.facebook.com/v18.0/${pageId}/photos`;
  const params = new URLSearchParams({
    url: imageUrl,
    message,
    access_token: accessToken,
  });

  const response = await fetch(`${url}?${params}`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await parseMetaError(response);
    throw error;
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function parseMetaError(response: Response): Promise<Error> {
  let errorBody: unknown;
  try {
    errorBody = await response.json();
  } catch {
    errorBody = null;
  }

  const status = response.status;

  if (status === 401 || status === 403) {
    return new AuthError("Platform authentication failed — token may be expired or revoked");
  }

  if (status === 429) {
    return new RateLimitError("Platform rate limit exceeded", 60000);
  }

  const message =
    typeof errorBody === "object" && errorBody !== null && "error" in errorBody
      ? (errorBody as Record<string, unknown>).error?.toString() || response.statusText
      : response.statusText;

  return new Error(`Platform API error (${status}): ${message}`);
}
