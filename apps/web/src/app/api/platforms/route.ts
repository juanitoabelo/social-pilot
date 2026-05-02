import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const platform = searchParams.get("platform");

  if (!workspaceId || !platform) {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_INPUT", message: "workspaceId and platform are required" } },
      { status: 400 }
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
  if (!workspaceIds.includes(workspaceId)) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Not a member of this workspace" } },
      { status: 403 }
    );
  }

  await prisma.platform_connection.delete({
    where: {
      workspace_id_platform: {
        workspace_id: workspaceId,
        platform,
      },
    },
  });

  return NextResponse.json({ data: null, error: null });
}
