import { sendEmail } from "./client";
import {
  postPublishedEmail,
  postFailedEmail,
  weeklyDigestEmail,
  planLimitWarningEmail,
} from "./templates";

export async function notifyPostPublished(
  userEmail: string,
  postData: {
    platform: string;
    caption: string;
    publishedAt: string;
    imageUrl?: string;
    postUrl?: string;
  }
) {
  const html = postPublishedEmail(postData);
  return sendEmail(userEmail, `Post published on ${postData.platform}`, html);
}

export async function notifyPostFailed(
  userEmail: string,
  postData: {
    platform: string;
    caption: string;
    error: string;
    retryUrl: string;
  }
) {
  const html = postFailedEmail(postData);
  return sendEmail(userEmail, `Post failed to publish on ${postData.platform}`, html);
}

export async function sendWeeklyDigest(
  userEmail: string,
  workspaceName: string,
  data: {
    weekRange: string;
    totalPosts: number;
    avgEngagement: number;
    totalReach: number;
    topPlatform: string;
    topPosts: Array<{ caption: string; platform: string; engagement: number }>;
  }
) {
  const html = weeklyDigestEmail({ workspaceName, ...data });
  return sendEmail(userEmail, `Weekly Analytics: ${workspaceName}`, html);
}

export async function notifyPlanLimit(
  userEmail: string,
  data: {
    planName: string;
    generationsUsed: number;
    generationsLimit: number;
    upgradeUrl: string;
  }
) {
  const html = planLimitWarningEmail(data);
  return sendEmail(userEmail, "Plan limit approaching", html);
}
