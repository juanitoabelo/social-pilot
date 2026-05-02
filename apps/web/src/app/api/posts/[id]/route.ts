import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function verifyPostAccess(postId: string, userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      workspaces: {
        select: { workspace_id: true },
      },
    },
  });

  if (!user) return null;

  const workspaceIds = user.workspaces.map((w) => w.workspace_id);

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      campaign: {
        workspace_id: {
          in: workspaceIds,
        },
      },
    },
    include: {
      assets: true,
      campaign: true,
    },
  });

  return { post, user };
}

export async function PATCH(
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

    const { post } = await verifyPostAccess(params.id, session.user.email) || {};

    if (!post) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { caption, hashtags, cta } = body;

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        caption: caption ?? post.caption,
        hashtags: hashtags ?? post.hashtags,
        cta: cta ?? post.cta,
      },
      include: {
        assets: true,
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error("Update post error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update post" } },
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

    const { post } = await verifyPostAccess(params.id, session.user.email) || {};

    if (!post) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
        { status: 404 }
      );
    }

    await prisma.post.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to delete post" } },
      { status: 500 }
    );
  }
}

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

    const { post } = await verifyPostAccess(params.id, session.user.email) || {};

    if (!post) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === "approve") {
      const updated = await prisma.post.update({
        where: { id: params.id },
        data: { status: "approved" },
        include: { assets: true },
      });
      return NextResponse.json({ data: updated, error: null });
    }

    if (action === "reject") {
      await prisma.post.delete({
        where: { id: params.id },
      });
      return NextResponse.json({ data: null, error: null });
    }

    return NextResponse.json(
      { data: null, error: { code: "INVALID_INPUT", message: "Invalid action" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Post action error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to process action" } },
      { status: 500 }
    );
  }
}
