import { prisma } from "../lib/prisma";

export async function buildPerformanceContext(workspaceId: string): Promise<string> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const topPosts = await prisma.$queryRaw<Array<{
    caption: string;
    platform: string;
    peak_eng: number;
    day_of_week: number;
    hour: number;
  }>>`
    SELECT p.caption, p.platform,
           MAX(pm.engagement_rate) as peak_eng,
           EXTRACT(DOW FROM p.published_at) as day_of_week,
           EXTRACT(HOUR FROM p.published_at) as hour
    FROM "Post" p
    JOIN "PostMetrics" pm ON pm.post_id = p.id
    JOIN "Campaign" c ON c.id = p.campaign_id
    WHERE c.workspace_id = ${workspaceId}
      AND p.published_at > ${sixtyDaysAgo}
    GROUP BY p.id
    ORDER BY peak_eng DESC
    LIMIT 5
  `;

  const bottomPosts = await prisma.$queryRaw<Array<{
    caption: string;
    platform: string;
    peak_eng: number;
    day_of_week: number;
    hour: number;
  }>>`
    SELECT p.caption, p.platform,
           MAX(pm.engagement_rate) as peak_eng,
           EXTRACT(DOW FROM p.published_at) as day_of_week,
           EXTRACT(HOUR FROM p.published_at) as hour
    FROM "Post" p
    JOIN "PostMetrics" pm ON pm.post_id = p.id
    JOIN "Campaign" c ON c.id = p.campaign_id
    WHERE c.workspace_id = ${workspaceId}
      AND p.published_at > ${sixtyDaysAgo}
    GROUP BY p.id
    ORDER BY peak_eng ASC
    LIMIT 3
  `;

  if (topPosts.length === 0) {
    return "";
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let context = "\nPerformance insights from your past posts (last 60 days):\n\n";

  context += "TOP PERFORMING posts (highest engagement rate):\n";
  for (const post of topPosts) {
    const day = dayNames[Math.floor(post.day_of_week)] || "Unknown";
    const hour = Math.floor(post.hour);
    const timeStr = hour >= 12 ? `${hour === 12 ? 12 : hour - 12} PM` : `${hour === 0 ? 12 : hour} AM`;
    context += `- ${post.platform}: "${post.caption.slice(0, 80)}..." (${(post.peak_eng * 100).toFixed(1)}% engagement, ${day} at ${timeStr})\n`;
  }

  if (bottomPosts.length > 0) {
    context += "\nLOWEST PERFORMING posts (avoid these patterns):\n";
    for (const post of bottomPosts) {
      context += `- ${post.platform}: "${post.caption.slice(0, 80)}..." (${(post.peak_eng * 100).toFixed(1)}% engagement)\n`;
    }
  }

  const platformBest = topPosts.reduce<Record<string, { bestDay: string; bestHour: number; avgEng: number; count: number }>>((acc, post) => {
    if (!acc[post.platform]) {
      acc[post.platform] = { bestDay: dayNames[Math.floor(post.day_of_week)] || "Unknown", bestHour: Math.floor(post.hour), avgEng: post.peak_eng, count: 1 };
    } else {
      acc[post.platform].count++;
      acc[post.platform].avgEng = (acc[post.platform].avgEng + post.peak_eng) / 2;
    }
    return acc;
  }, {});

  context += "\nBest posting times by platform:\n";
  for (const [platform, data] of Object.entries(platformBest)) {
    const hour = data.bestHour;
    const timeStr = hour >= 12 ? `${hour === 12 ? 12 : hour - 12} PM` : `${hour === 0 ? 12 : hour} AM`;
    context += `- ${platform}: ${data.bestDay} around ${timeStr} (avg ${(data.avgEng * 100).toFixed(1)}% engagement across ${data.count} posts)\n`;
  }

  context += "\nUse these insights to inform your new content. Write copy similar to top performers.";

  return context;
}
