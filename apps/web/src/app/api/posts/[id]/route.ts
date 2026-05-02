import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis-client";

const SCHEDULED_POSTS_QUEUE = "scheduled-posts";

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

async function getQueue(): Promise<Queue> {
  const connection = await getRedis();
  return new Queue(SCHEDULED_POSTS_QUEUE, { connection });
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

    const body = await request.json();
    const { action, scheduledAt } = body;

    if (action === "schedule") {
      if (!scheduledAt) {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_INPUT", message: "scheduledAt is required" } },
          { status: 400 }
        );
      }

      const scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_INPUT", message: "Invalid date format" } },
          { status: 400 }
        );
      }

      if (scheduleDate <= new Date()) {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_INPUT", message: "Schedule date must be in the future" } },
          { status: 400 }
        );
      }

      const { post } = await verifyPostAccess(params.id, session.user.email) || {};

      if (!post) {
        return NextResponse.json(
          { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
          { status: 404 }
        );
      }

      if (post.status !== "approved") {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_STATE", message: "Post must be approved before scheduling" } },
          { status: 400 }
        );
      }

      const queue = await getQueue();
      const delay = scheduleDate.getTime() - Date.now();

      const job = await queue.add(
        `publish-${params.id}`,
        { postId: params.id, platform: post.platform },
        {
          delay,
          jobId: `publish-${params.id}`,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: "exponential", delay: 60000 },
        }
      );

      await prisma.scheduleJob.create({
        data: {
          post_id: params.id,
          bullmq_job_id: job.id?.toString(),
          scheduled_at: scheduleDate,
          status: "pending",
        },
      });

      const updated = await prisma.post.update({
        where: { id: params.id },
        data: {
          status: "scheduled",
          scheduled_at: scheduleDate,
        },
        include: { assets: true },
      });

      await queue.close();
      return NextResponse.json({ data: updated, error: null });
    }

    if (action === "approve") {
      const { post } = await verifyPostAccess(params.id, session.user.email) || {};

      if (!post) {
        return NextResponse.json(
          { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
          { status: 404 }
        );
      }

      const updated = await prisma.post.update({
        where: { id: params.id },
        data: { status: "approved" },
        include: { assets: true },
      });
      return NextResponse.json({ data: updated, error: null });
    }

    if (action === "reject") {
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
    }

    if (action === "cancel_schedule") {
      const { post } = await verifyPostAccess(params.id, session.user.email) || {};

      if (!post) {
        return NextResponse.json(
          { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
          { status: 404 }
        );
      }

      if (post.status !== "scheduled") {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_STATE", message: "Post is not scheduled" } },
          { status: 400 }
        );
      }

      const queue = await getQueue();
      const job = await queue.getJob(`publish-${params.id}`);
      if (job) {
        await job.remove();
      }
      await queue.close();

      await prisma.scheduleJob.updateMany({
        where: { post_id: params.id, status: "pending" },
        data: { status: "cancelled", updated_at: new Date() },
      });

      const updated = await prisma.post.update({
        where: { id: params.id },
        data: { status: "approved", scheduled_at: null },
        include: { assets: true },
      });

      return NextResponse.json({ data: updated, error: null });
    }

    if (action === "reschedule") {
      if (!scheduledAt) {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_INPUT", message: "scheduledAt is required" } },
          { status: 400 }
        );
      }

      const scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_INPUT", message: "Invalid date format" } },
          { status: 400 }
        );
      }

      const { post } = await verifyPostAccess(params.id, session.user.email) || {};

      if (!post) {
        return NextResponse.json(
          { data: null, error: { code: "NOT_FOUND", message: "Post not found" } },
          { status: 404 }
        );
      }

      if (post.status !== "scheduled") {
        return NextResponse.json(
          { data: null, error: { code: "INVALID_STATE", message: "Post must be scheduled to reschedule" } },
          { status: 400 }
        );
      }

      const queue = await getQueue();
      const oldJob = await queue.getJob(`publish-${params.id}`);
      if (oldJob) {
        await oldJob.remove();
      }

      const delay = scheduleDate.getTime() - Date.now();
      const job = await queue.add(
        `publish-${params.id}`,
        { postId: params.id, platform: post.platform },
        {
          delay,
          jobId: `publish-${params.id}`,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: "exponential", delay: 60000 },
        }
      );

      await prisma.scheduleJob.updateMany({
        where: { post_id: params.id, status: "pending" },
        data: {
          status: "cancelled",
          updated_at: new Date(),
        },
      });

      await prisma.scheduleJob.create({
        data: {
          post_id: params.id,
          bullmq_job_id: job.id?.toString(),
          scheduled_at: scheduleDate,
          status: "pending",
        },
      });

      const updated = await prisma.post.update({
        where: { id: params.id },
        data: { scheduled_at: scheduleDate },
        include: { assets: true },
      });

      await queue.close();
      return NextResponse.json({ data: updated, error: null });
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

    if (post.status === "scheduled") {
      const queue = await getQueue();
      const job = await queue.getJob(`publish-${params.id}`);
      if (job) {
        await job.remove();
      }
      await queue.close();

      await prisma.scheduleJob.updateMany({
        where: { post_id: params.id, status: "pending" },
        data: { status: "cancelled", updated_at: new Date() },
      });
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
