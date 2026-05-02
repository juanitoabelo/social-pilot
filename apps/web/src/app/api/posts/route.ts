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

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        workspaces: {
          select: { workspace_id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceIds = user.workspaces.map((w) => w.workspace_id);

    const whereClause: Record<string, unknown> = {
      campaign: {
        workspace_id: {
          in: workspaceIds,
        },
      },
    };

    if (campaignId) {
      whereClause.campaign_id = campaignId;
    }

    if (status) {
      whereClause.status = status;
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        assets: true,
        campaign: true,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ data: posts, error: null });
  } catch (error) {
    console.error("Fetch posts error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch posts" } },
      { status: 500 }
    );
  }
}
