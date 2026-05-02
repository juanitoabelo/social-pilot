import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    const days = parseInt(searchParams.get("days") || "30", 10);
    const platform = searchParams.get("platform") || undefined;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const publishedPosts = await prisma.post.findMany({
      where: {
        campaign: { workspace_id: workspaceId },
        status: "published",
        published_at: { gte: since },
        ...(platform ? { platform } : {}),
      },
      select: {
        id: true,
        platform: true,
        caption: true,
        hashtags: true,
        published_at: true,
        platform_post_id: true,
        assets: {
          where: { type: "image" },
          take: 1,
          select: { url: true },
        },
        metrics: {
          orderBy: { fetched_at: "desc" },
          take: 1,
        },
      },
      orderBy: { published_at: "desc" },
    });

    const metricsByDay: Record<
      string,
      {
        date: string;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        reach: number;
        impressions: number;
        engagement_rate: number;
      }
    > = {};

    const metricsByPlatform: Record<
      string,
      {
        platform: string;
        posts: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        reach: number;
        impressions: number;
        avg_engagement_rate: number;
        total_engagement_rates: number;
      }
    > = {};

    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalReach = 0;
    let totalImpressions = 0;
    let engagementRates: number[] = [];

    for (const post of publishedPosts) {
      const latest = post.metrics[0];
      if (!latest) continue;

      totalLikes += latest.likes;
      totalComments += latest.comments;
      totalShares += latest.shares;
      totalSaves += latest.saves;
      totalReach += latest.reach;
      totalImpressions += latest.impressions;
      engagementRates.push(latest.engagement_rate);

      const dateKey = post.published_at?.toISOString().split("T")[0] || "";
      if (dateKey) {
        if (!metricsByDay[dateKey]) {
          metricsByDay[dateKey] = {
            date: dateKey,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            reach: 0,
            impressions: 0,
            engagement_rate: 0,
          };
        }
        metricsByDay[dateKey].likes += latest.likes;
        metricsByDay[dateKey].comments += latest.comments;
        metricsByDay[dateKey].shares += latest.shares;
        metricsByDay[dateKey].saves += latest.saves;
        metricsByDay[dateKey].reach += latest.reach;
        metricsByDay[dateKey].impressions += latest.impressions;
      }

      if (!metricsByPlatform[post.platform]) {
        metricsByPlatform[post.platform] = {
          platform: post.platform,
          posts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          reach: 0,
          impressions: 0,
          avg_engagement_rate: 0,
          total_engagement_rates: 0,
        };
      }
      metricsByPlatform[post.platform].posts++;
      metricsByPlatform[post.platform].likes += latest.likes;
      metricsByPlatform[post.platform].comments += latest.comments;
      metricsByPlatform[post.platform].shares += latest.shares;
      metricsByPlatform[post.platform].saves += latest.saves;
      metricsByPlatform[post.platform].reach += latest.reach;
      metricsByPlatform[post.platform].impressions += latest.impressions;
      metricsByPlatform[post.platform].total_engagement_rates += latest.engagement_rate;
    }

    const avgEngagementRate =
      engagementRates.length > 0
        ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length
        : 0;

    for (const key of Object.keys(metricsByPlatform)) {
      const p = metricsByPlatform[key];
      p.avg_engagement_rate =
        p.posts > 0 ? p.total_engagement_rates / p.posts : 0;
    }

    const sortedDays = Object.keys(metricsByDay).sort();
    const engagementOverTime = sortedDays.map((date) => {
      const d = metricsByDay[date];
      const total = d.likes + d.comments + d.shares + d.saves;
      return {
        date,
        engagement_rate: d.reach > 0 ? total / d.reach : 0,
        likes: d.likes,
        comments: d.comments,
        shares: d.shares,
        saves: d.saves,
        reach: d.reach,
        impressions: d.impressions,
      };
    });

    const topPosts = publishedPosts
      .filter((p) => p.metrics.length > 0)
      .map((p) => ({
        id: p.id,
        platform: p.platform,
        caption: p.caption,
        hashtags: p.hashtags,
        published_at: p.published_at,
        image_url: p.assets[0]?.url || null,
        engagement_rate: p.metrics[0].engagement_rate,
        likes: p.metrics[0].likes,
        comments: p.metrics[0].comments,
        shares: p.metrics[0].shares,
        saves: p.metrics[0].saves,
        reach: p.metrics[0].reach,
      }))
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 10);

    const platforms = Object.values(metricsByPlatform);

    return NextResponse.json({
      data: {
        summary: {
          total_posts: publishedPosts.length,
          avg_engagement_rate: avgEngagementRate,
          total_reach: totalReach,
          total_impressions: totalImpressions,
          total_likes: totalLikes,
          total_comments: totalComments,
          total_shares: totalShares,
          total_saves: totalSaves,
        },
        engagement_over_time: engagementOverTime,
        platforms,
        top_posts: topPosts,
      },
      error: null,
    });
  } catch (error) {
    console.error("Fetch analytics error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}
