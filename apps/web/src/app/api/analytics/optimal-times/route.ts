import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface OptimalTimeSlot {
  dayOfWeek: number;
  dayName: string;
  hour: number;
  timeLabel: string;
  avgEngagementRate: number;
  postCount: number;
  platform: string;
  isEstimate?: boolean;
}

interface PlatformOptimalTimes {
  platform: string;
  slots: OptimalTimeSlot[];
  overallBestSlot: OptimalTimeSlot | null;
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
  defaults: { hour: number; dayOfWeek: number }[],
  platform: string
): OptimalTimeSlot[] {
  if (realData.length === 0) {
    return defaults.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      dayName: DAY_NAMES[d.dayOfWeek],
      hour: d.hour,
      timeLabel: formatHourLabel(d.hour),
      avgEngagementRate: 0,
      postCount: 0,
      platform,
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
      platform,
      isEstimate: true,
    }));

  return [...realData, ...additional];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        workspaces: {
          select: { workspace_id: true },
        },
      },
    });

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "NO_WORKSPACE", message: "No workspace found" } },
        { status: 400 }
      );
    }

    const workspaceId = user.workspaces[0].workspace_id;
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || undefined;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const whereClause = platform
      ? `AND p.platform = '${platform}'`
      : '';

    const results = await prisma.$queryRawUnsafe<
      Array<{
        platform: string;
        day_of_week: number;
        hour: number;
        avg_eng: number;
        post_count: number;
      }>
    >(`
      SELECT
        p.platform,
        EXTRACT(DOW FROM p.published_at) as day_of_week,
        EXTRACT(HOUR FROM p.published_at) as hour,
        AVG(pm.engagement_rate) as avg_eng,
        COUNT(DISTINCT p.id) as post_count
      FROM "Post" p
      JOIN "Campaign" c ON c.id = p.campaign_id
      JOIN "PostMetrics" pm ON pm.post_id = p.id
      WHERE c.workspace_id = $1
        AND p.published_at > $2
        AND p.published_at IS NOT NULL
        ${whereClause}
      GROUP BY p.platform, EXTRACT(DOW FROM p.published_at), EXTRACT(HOUR FROM p.published_at)
      HAVING COUNT(DISTINCT p.id) >= 1
      ORDER BY p.platform, avg_eng DESC
    `, workspaceId, ninetyDaysAgo);

    const byPlatform = results.reduce<
      Record<string, { platform: string; slots: OptimalTimeSlot[] }>
    >((acc, row) => {
      if (!acc[row.platform]) {
        acc[row.platform] = { platform: row.platform, slots: [] };
      }

      const hour = Math.floor(Number(row.hour));

      acc[row.platform].slots.push({
        dayOfWeek: Math.floor(Number(row.day_of_week)),
        dayName: DAY_NAMES[Math.floor(Number(row.day_of_week))] || "Unknown",
        hour,
        timeLabel: formatHourLabel(hour),
        avgEngagementRate: Number(row.avg_eng),
        postCount: Number(row.post_count),
        platform: row.platform,
      });

      return acc;
    }, {});

    const industryDefaults = getIndustryDefaults();

    const platformResults: PlatformOptimalTimes[] = Object.values(byPlatform).map(
      (platformData) => {
        const sorted = platformData.slots
          .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
          .slice(0, 5);

        const defaults = industryDefaults[platformData.platform] || [];
        const allSlots = mergeWithDefaults(sorted, defaults, platformData.platform);

        return {
          platform: platformData.platform,
          slots: allSlots.slice(0, 5),
          overallBestSlot: allSlots[0] || null,
        };
      }
    );

    if (platformResults.length === 0) {
      const platforms = platform ? [platform] : ["instagram", "facebook"];
      const defaults = getIndustryDefaults();

      for (const p of platforms) {
        const pDefaults = defaults[p] || [];
        if (pDefaults.length > 0) {
          platformResults.push({
            platform: p,
            slots: pDefaults.slice(0, 5).map((d) => ({
              dayOfWeek: d.dayOfWeek,
              dayName: DAY_NAMES[d.dayOfWeek],
              hour: d.hour,
              timeLabel: formatHourLabel(d.hour),
              avgEngagementRate: 0,
              postCount: 0,
              platform: p,
              isEstimate: true,
            })),
            overallBestSlot: null,
          });
        }
      }
    }

    return NextResponse.json({ data: platformResults, error: null });
  } catch (error) {
    console.error("Fetch optimal times error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch optimal times" } },
      { status: 500 }
    );
  }
}
