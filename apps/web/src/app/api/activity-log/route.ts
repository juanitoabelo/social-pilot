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
        { data: null, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceIds = user.workspaces.map((w) => w.workspace_id);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const workspaceId = searchParams.get("workspace_id");
    const action = searchParams.get("action");

    const where = {
      workspace_id: workspaceId && workspaceIds.includes(workspaceId) ? workspaceId : { in: workspaceIds },
      ...(action ? { action } : {}),
    };

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: Math.min(limit, 200),
    });

    return NextResponse.json({ data: logs, error: null });
  } catch (error) {
    console.error("Get activity log error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch activity log" } },
      { status: 500 }
    );
  }
}
