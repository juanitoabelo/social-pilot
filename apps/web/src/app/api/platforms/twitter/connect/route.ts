import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;

const SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
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

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = Buffer.from(
    JSON.stringify({
      userId: user.id,
      workspaceId,
      codeVerifier,
    })
  ).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: TWITTER_CLIENT_ID ?? "",
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/platforms/twitter/callback`,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params}`;

  return NextResponse.redirect(authUrl);
}

function generateCodeVerifier(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString("base64url");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("base64url");
}
