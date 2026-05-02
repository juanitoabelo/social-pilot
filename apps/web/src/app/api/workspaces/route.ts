import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    });

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Workspace name is required" } },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await prisma.workspace.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { data: null, error: { code: "SLUG_TAKEN", message: "Workspace name already taken" } },
        { status: 409 }
      );
    }

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name,
          slug,
          brand_config: {
            brand_name: name,
            tone: "professional",
            do: [],
            dont: [],
            hashtag_style: "mixed",
            emoji_policy: "moderate",
          },
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspace_id: ws.id,
          user_id: user.id,
          role: "owner",
        },
      });

      return ws;
    });

    return NextResponse.json({ data: workspace, error: null });
  } catch (error) {
    console.error("Workspace creation error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create workspace" } },
      { status: 500 }
    );
  }
}
