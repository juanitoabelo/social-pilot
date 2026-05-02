import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
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
      include: {
        posts: {
          include: {
            assets: true,
          },
          orderBy: { created_at: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Campaign not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: campaign, error: null });
  } catch (error) {
    console.error("Fetch campaign error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch campaign" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: params.id,
        workspace_id: {
          in: workspaceIds,
        },
      },
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Campaign not found" } },
        { status: 404 }
      );
    }

    await prisma.campaign.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("Delete campaign error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to delete campaign" } },
      { status: 500 }
    );
  }
}
