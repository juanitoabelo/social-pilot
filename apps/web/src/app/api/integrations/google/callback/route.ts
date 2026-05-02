import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set");
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
      `${process.env.NEXTAUTH_URL}/dashboard/campaigns?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/campaigns?error=missing_params`
    );
  }

  let state: { userId: string; workspaceId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/campaigns?error=invalid_state`
    );
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID ?? "",
      client_secret: GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => null);
      console.error("Google token exchange failed:", errData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/campaigns?error=token_exchange_failed`
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
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
          platform: "google_sheets",
        },
      },
      create: {
        workspace_id: state.workspaceId,
        platform: "google_sheets",
        access_token: encryptedToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
        scopes: tokenData.scope.split(" "),
        platform_user_id: null,
        platform_username: "Google Sheets",
      },
      update: {
        access_token: encryptedToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/campaigns?google_connected=true`
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/campaigns?error=connection_failed`
    );
  }
}
