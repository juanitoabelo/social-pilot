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

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceIds = user.workspaces.map((w) => w.workspace_id);

    const campaigns = await prisma.campaign.findMany({
      where: {
        workspace_id: {
          in: workspaceIds,
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ data: campaigns, error: null });
  } catch (error) {
    console.error("Fetch campaigns error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch campaigns" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, brief, tone, audience, platforms, useBrandConfig } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Title is required" } },
        { status: 400 }
      );
    }

    const workspaceId = user.workspaces[0].workspace_id;

    const campaign = await prisma.campaign.create({
      data: {
        workspace_id: workspaceId,
        title: title.trim(),
        brief: brief || "",
        audience: audience || {},
        platforms: platforms || [],
        status: "draft",
        created_by: user.id,
      },
    });

    return NextResponse.json({ data: campaign, error: null }, { status: 201 });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create campaign" } },
      { status: 500 }
    );
  }
}
