import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
    const { name, brandConfig } = body as { name: string; brandConfig: Record<string, unknown> };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Workspace name is required" } },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { data: null, error: { code: "DUPLICATE", message: "Workspace with this name already exists" } },
        { status: 400 }
      );
    }

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: name.trim(),
          slug,
          brand_config: (brandConfig || {}) as Prisma.InputJsonValue,
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

    return NextResponse.json({ data: workspace, error: null }, { status: 201 });
  } catch (error) {
    console.error("Setup workspace error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create workspace" } },
      { status: 500 }
    );
  }
}
