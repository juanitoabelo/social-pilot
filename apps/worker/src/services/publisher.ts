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
    case "twitter":
      return publishToTwitter(payload);
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

async function publishToTwitter(payload: PublishPayload): Promise<PublishResult> {
  const accessToken = getDecryptedToken(payload.accessToken);
  const fullCaption = buildTwitterCaption(payload.caption, payload.hashtags);

  const mediaId = payload.assetUrls[0]
    ? await uploadMediaToTwitter(payload.assetUrls[0], accessToken)
    : null;

  const tweetId = await createTweet(fullCaption, mediaId, accessToken);

  return {
    platform_post_id: tweetId,
    url: `https://twitter.com/i/web/status/${tweetId}`,
  };
}

function buildTwitterCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .slice(0, 3)
    .join(" ");
  const combined = tags ? `${caption}\n\n${tags}` : caption;
  return combined.length > 280 ? `${combined.slice(0, 277)}...` : combined;
}

async function uploadMediaToTwitter(
  imageUrl: string,
  bearerToken: string
): Promise<string> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const initResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      command: "INIT",
      media_type: "image/jpeg",
      total_bytes: imageBuffer.length,
    }),
  });

  if (!initResponse.ok) {
    const error = await parseTwitterError(initResponse);
    throw error;
  }

  const initData = (await initResponse.json()) as { media_id_string: string };
  const mediaId = initData.media_id_string;

  const chunkSize = 5 * 1024 * 1024;
  let segmentIndex = 0;
  for (let offset = 0; offset < imageBuffer.length; offset += chunkSize) {
    const chunk = imageBuffer.slice(offset, offset + chunkSize);
    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", String(segmentIndex));
    formData.append("media", new Blob([chunk]), "image.jpg");

    const appendResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
      body: formData,
    });

    if (!appendResponse.ok) {
      throw new Error(`Failed to upload media chunk ${segmentIndex}`);
    }
    segmentIndex++;
  }

  const finalizeResponse = await fetch(
    `https://upload.twitter.com/1.1/media/upload.json?command=FINALIZE&media_id=${mediaId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    }
  );

  if (!finalizeResponse.ok) {
    throw new Error("Failed to finalize media upload");
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  return mediaId;
}

async function createTweet(
  text: string,
  mediaId: string | null,
  bearerToken: string
): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (mediaId) {
    body.media = { media_ids: [mediaId] };
  }

  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await parseTwitterError(response);
    throw error;
  }

  const data = (await response.json()) as { data: { id: string } };
  return data.data.id;
}

async function parseTwitterError(response: Response): Promise<Error> {
  let errorBody: unknown;
  try {
    errorBody = await response.json();
  } catch {
    errorBody = null;
  }

  const status = response.status;

  if (status === 401 || status === 403) {
    return new AuthError("X/Twitter authentication failed — token may be expired or revoked");
  }

  if (status === 429) {
    return new RateLimitError("X/Twitter rate limit exceeded", 900000);
  }

  const errors =
    typeof errorBody === "object" && errorBody !== null && "errors" in errorBody
      ? (errorBody as Record<string, unknown>).errors
      : null;

  const message = Array.isArray(errors)
    ? (errors[0] as Record<string, unknown>)?.message?.toString() || response.statusText
    : response.statusText;

  return new Error(`X/Twitter API error (${status}): ${message}`);
}
