import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceIds = user.workspaces.map((w) => w.workspace_id);

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        workspace_id: {
          in: workspaceIds,
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Campaign not found" } },
        { status: 404 }
      );
    }

    if (campaign.platforms.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "No platforms selected" } },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "generating" },
    });

    const connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });

    const contentQueue = new Queue("content-generation", {
      connection,
    });

    await contentQueue.add("generate-content", {
      campaignId: campaign.id,
      workspaceId: campaign.workspace_id,
      brief: campaign.brief,
      platforms: campaign.platforms,
      audience: campaign.audience,
    });

    await connection.quit();

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Error starting content generation:", error);
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: "draft" },
    });
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to start content generation" } },
      { status: 500 }
    );
  }
}
