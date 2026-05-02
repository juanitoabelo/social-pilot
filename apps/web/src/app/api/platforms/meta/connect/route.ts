import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_content_publish",
  "public_profile",
].join(",");

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      workspaces: {
        select: { workspace_id: true, role: true },
      },
    },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const workspaceId = user.workspaces[0]?.workspace_id;
  if (!workspaceId) {
    return new Response("No workspace", { status: 400 });
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, workspaceId })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: META_APP_ID ?? "",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/platforms/meta/callback`,
    response_type: "code",
    scope: SCOPES,
    state,
  });

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${params}`;

  return NextResponse.redirect(authUrl);
}
