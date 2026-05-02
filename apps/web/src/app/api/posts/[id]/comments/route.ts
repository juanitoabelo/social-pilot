import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";

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
      campaign: {
        select: { workspace_id: true },
      },
    },
  });

  return { post, user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { post, user } = await verifyPostAccess(params.postId, session.user.email) || {};

    if (!post || !user) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
        { status: 404 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { post_id: params.postId },
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
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json({ data: comments, error: null });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch comments" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { post, user } = await verifyPostAccess(params.postId, session.user.email) || {};

    if (!post || !user) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { body: commentBody } = body;

    if (!commentBody || typeof commentBody !== "string" || commentBody.trim().length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Comment body is required" } },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        post_id: params.postId,
        user_id: user.id,
        body: commentBody.trim(),
      },
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
    });

    await logActivity({
      workspace_id: post.campaign.workspace_id,
      user_id: user.id,
      action: "comment_added",
      entity_type: "comment",
      entity_id: comment.id,
      metadata: { post_id: params.postId },
    });

    return NextResponse.json({ data: comment, error: null });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create comment" } },
      { status: 500 }
    );
  }
}
