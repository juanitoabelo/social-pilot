import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGoogleAccessToken, listSpreadsheets } from "@worker/services/google-sheets/client";

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

    const workspaceId = user.workspaces[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No workspace" } },
        { status: 400 }
      );
    }

    const accessToken = await getGoogleAccessToken(workspaceId);
    const sheets = await listSpreadsheets(accessToken);

    return NextResponse.json({ data: sheets, error: null });
  } catch (error) {
    console.error("List sheets error:", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to list sheets",
        },
      },
      { status: 500 }
    );
  }
}
