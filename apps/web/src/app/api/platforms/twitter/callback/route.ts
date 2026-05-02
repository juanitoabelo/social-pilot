import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
  console.error("TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET not set");
}

if (!ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY not set");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=missing_params`
    );
  }

  let state: { userId: string; workspaceId: string; codeVerifier: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state`
    );
  }

  try {
    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: TWITTER_CLIENT_ID ?? "",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/platforms/twitter/callback`,
      code_verifier: state.codeVerifier,
    });

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => null);
      console.error("Twitter token exchange failed:", errData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=token_exchange_failed`
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    const meResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!meResponse.ok) {
      throw new Error("Failed to fetch Twitter user info");
    }

    const meData = (await meResponse.json()) as {
      data: { id: string; username: string };
    };

    const encryptedToken = encrypt(tokenData.access_token, ENCRYPTION_KEY ?? "");
    const encryptedRefreshToken = encrypt(
      tokenData.refresh_token,
      ENCRYPTION_KEY ?? ""
    );

    await prisma.platformConnection.upsert({
      where: {
        workspace_id_platform: {
          workspace_id: state.workspaceId,
          platform: "twitter",
        },
      },
      create: {
        workspace_id: state.workspaceId,
        platform: "twitter",
        access_token: encryptedToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
        scopes: tokenData.scope.split(" "),
        platform_user_id: meData.data.id,
        platform_username: meData.data.username,
      },
      update: {
        access_token: encryptedToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
        platform_username: meData.data.username,
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?connected=true`
    );
  } catch (err) {
    console.error("Twitter OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=connection_failed`
    );
  }
}
