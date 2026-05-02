import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email",
  "profile",
].join(" ");

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
    client_id: GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  return NextResponse.redirect(authUrl);
}
