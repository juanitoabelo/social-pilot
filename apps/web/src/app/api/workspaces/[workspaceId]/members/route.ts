import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
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
          where: { workspace_id: params.workspaceId },
        },
      },
    });

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Not a member of this workspace" } },
        { status: 403 }
      );
    }

    const membership = user.workspaces[0];
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only owners and admins can invite members" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Email and role are required" } },
        { status: 400 }
      );
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Invalid role" } },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      return NextResponse.json(
        { data: null, error: { code: "USER_NOT_FOUND", message: "User not found. They need to sign up first." } },
        { status: 404 }
      );
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: params.workspaceId,
          user_id: targetUser.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { data: null, error: { code: "ALREADY_MEMBER", message: "User is already a member" } },
        { status: 409 }
      );
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspace_id: params.workspaceId,
        user_id: targetUser.id,
        role,
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json({ data: member, error: null });
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to add member" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
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
          where: { workspace_id: params.workspaceId },
        },
      },
    });

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Not a member of this workspace" } },
        { status: 403 }
      );
    }

    const membership = user.workspaces[0];
    if (membership.role !== "owner") {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only owners can change roles" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Member ID and role are required" } },
        { status: 400 }
      );
    }

    if (!["owner", "admin", "member"].includes(role)) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Invalid role" } },
        { status: 400 }
      );
    }

    const member = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: true,
      },
    });

    return NextResponse.json({ data: member, error: null });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update member" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
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
          where: { workspace_id: params.workspaceId },
        },
      },
    });

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Not a member of this workspace" } },
        { status: 403 }
      );
    }

    const membership = user.workspaces[0];
    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only owners and admins can remove members" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { memberId } = body;

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 }
      );
    }

    if (targetMember.workspace_id !== params.workspaceId) {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Member is not in this workspace" } },
        { status: 403 }
      );
    }

    if (targetMember.user_id === user.id) {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "You cannot remove yourself" } },
        { status: 400 }
      );
    }

    if (targetMember.role === "owner" && membership.role !== "owner") {
      return NextResponse.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only owners can remove other owners" } },
        { status: 403 }
      );
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } },
      { status: 500 }
    );
  }
}
