import { prisma } from "../lib/prisma";

export interface OptimalTimeSlot {
  dayOfWeek: number;
  dayName: string;
  hour: number;
  timeLabel: string;
  avgEngagementRate: number;
  postCount: number;
  platform: string;
  isEstimate?: boolean;
}

export interface PlatformOptimalTimes {
  platform: string;
  slots: OptimalTimeSlot[];
  overallBestSlot: OptimalTimeSlot | null;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export async function getOptimalPostingTimes(
  workspaceId: string
): Promise<PlatformOptimalTimes[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const results = await prisma.$queryRaw<
    Array<{
      platform: string;
      day_of_week: number;
      hour: number;
      avg_eng: number;
      post_count: number;
    }>
  >`
    SELECT
      p.platform,
      EXTRACT(DOW FROM p.published_at) as day_of_week,
      EXTRACT(HOUR FROM p.published_at) as hour,
      AVG(pm.engagement_rate) as avg_eng,
      COUNT(DISTINCT p.id) as post_count
    FROM "Post" p
    JOIN "Campaign" c ON c.id = p.campaign_id
    JOIN "PostMetrics" pm ON pm.post_id = p.id
    WHERE c.workspace_id = ${workspaceId}
      AND p.published_at > ${ninetyDaysAgo}
      AND p.published_at IS NOT NULL
    GROUP BY p.platform, EXTRACT(DOW FROM p.published_at), EXTRACT(HOUR FROM p.published_at)
    HAVING COUNT(DISTINCT p.id) >= 1
    ORDER BY p.platform, avg_eng DESC
  `;

  const byPlatform = results.reduce<
    Record<string, { platform: string; slots: OptimalTimeSlot[] }>
  >((acc, row) => {
    if (!acc[row.platform]) {
      acc[row.platform] = { platform: row.platform, slots: [] };
    }

    const hour = Math.floor(Number(row.hour));
    const timeLabel = formatHourLabel(hour);

    acc[row.platform].slots.push({
      dayOfWeek: Math.floor(Number(row.day_of_week)),
      dayName: DAY_NAMES[Math.floor(Number(row.day_of_week))] || "Unknown",
      hour,
      timeLabel,
      avgEngagementRate: Number(row.avg_eng),
      postCount: Number(row.post_count),
      platform: row.platform,
    });

    return acc;
  }, {});

  const industryDefaults = getIndustryDefaults();

  return Object.values(byPlatform).map((platformData) => {
    const sorted = platformData.slots
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
      .slice(0, 5);

    const allSlots = mergeWithDefaults(sorted, industryDefaults[platformData.platform] || []);

    return {
      platform: platformData.platform,
      slots: allSlots.slice(0, 5),
      overallBestSlot: allSlots[0] || null,
    };
  });
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function getIndustryDefaults(): Record<string, { hour: number; dayOfWeek: number }[]> {
  return {
    instagram: [
      { hour: 11, dayOfWeek: 1 },
      { hour: 14, dayOfWeek: 2 },
      { hour: 10, dayOfWeek: 4 },
      { hour: 15, dayOfWeek: 5 },
      { hour: 9, dayOfWeek: 3 },
    ],
    facebook: [
      { hour: 13, dayOfWeek: 2 },
      { hour: 14, dayOfWeek: 4 },
      { hour: 10, dayOfWeek: 1 },
      { hour: 11, dayOfWeek: 3 },
      { hour: 15, dayOfWeek: 5 },
    ],
  };
}

function mergeWithDefaults(
  realData: OptimalTimeSlot[],
  defaults: { hour: number; dayOfWeek: number }[]
): OptimalTimeSlot[] {
  if (realData.length === 0) {
    return defaults.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      dayName: DAY_NAMES[d.dayOfWeek],
      hour: d.hour,
      timeLabel: formatHourLabel(d.hour),
      avgEngagementRate: 0,
      postCount: 0,
      platform: "",
      isEstimate: true,
    }));
  }

  const existingKeys = new Set(
    realData.map((s) => `${s.dayOfWeek}-${s.hour}`)
  );

  const additional = defaults
    .filter((d) => !existingKeys.has(`${d.dayOfWeek}-${d.hour}`))
    .slice(0, Math.max(0, 5 - realData.length))
    .map((d) => ({
      dayOfWeek: d.dayOfWeek,
      dayName: DAY_NAMES[d.dayOfWeek],
      hour: d.hour,
      timeLabel: formatHourLabel(d.hour),
      avgEngagementRate: realData.length > 0 ? realData[realData.length - 1].avgEngagementRate * 0.8 : 0,
      postCount: 0,
      platform: realData[0]?.platform || "",
      isEstimate: true,
    }));

  return [...realData, ...additional];
}

export function getNextOptimalTime(
  platformOptimal: PlatformOptimalTimes
): Date | null {
  if (!platformOptimal.slots.length) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  for (const slot of platformOptimal.slots) {
    if (slot.isEstimate) continue;

    let daysUntilDay = slot.dayOfWeek - currentDay;
    if (daysUntilDay < 0 || (daysUntilDay === 0 && slot.hour <= currentHour)) {
      daysUntilDay += 7;
    }

    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysUntilDay);
    candidate.setHours(slot.hour, 0, 0, 0);

    if (candidate > now) {
      return candidate;
    }
  }

  const best = platformOptimal.slots[0];
  if (!best) return null;

  let daysUntilDay = best.dayOfWeek - currentDay;
  if (daysUntilDay < 0) daysUntilDay += 7;
  if (daysUntilDay === 0 && best.hour <= currentHour) daysUntilDay += 7;

  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + daysUntilDay);
  candidate.setHours(best.hour, 0, 0, 0);

  return candidate;
}
