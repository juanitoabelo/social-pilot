import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!META_APP_ID || !META_APP_SECRET) {
  console.error("META_APP_ID or META_APP_SECRET not set");
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

  let state: { userId: string; workspaceId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=invalid_state`
    );
  }

  try {
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/platforms/meta/callback`,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => null);
      console.error("Token exchange failed:", errData);
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=token_exchange_failed`
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
    };

    const longLivedToken = await getLongLivedToken(tokenData.access_token);

    const pages = await fetchPages(longLivedToken);

    if (!pages || pages.length === 0) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/settings?error=no_pages_found`
      );
    }

    const page = pages[0];

    const encryptedToken = encrypt(longLivedToken, ENCRYPTION_KEY ?? "");

    const instagramAccount = await fetchInstagramAccount(
      page.id,
      longLivedToken
    );

    await prisma.platform_connection.upsert({
      where: {
        workspace_id_platform: {
          workspace_id: state.workspaceId,
          platform: "facebook",
        },
      },
      create: {
        workspace_id: state.workspaceId,
        platform: "facebook",
        access_token: encryptedToken,
        refresh_token: null,
        token_expires_at: null,
        scopes: [
          "pages_show_list",
          "pages_manage_posts",
          "pages_read_engagement",
        ],
        platform_user_id: page.id,
        platform_username: page.name,
      },
      update: {
        access_token: encryptedToken,
        token_expires_at: null,
        platform_username: page.name,
      },
    });

    if (instagramAccount) {
      await prisma.platform_connection.upsert({
        where: {
          workspace_id_platform: {
            workspace_id: state.workspaceId,
            platform: "instagram",
          },
        },
        create: {
          workspace_id: state.workspaceId,
          platform: "instagram",
          access_token: encryptedToken,
          refresh_token: null,
          token_expires_at: null,
          scopes: [
            "instagram_basic",
            "instagram_content_publish",
            "instagram_manage_comments",
          ],
          platform_user_id: instagramAccount.id,
          platform_username: instagramAccount.username,
        },
        update: {
          access_token: encryptedToken,
          token_expires_at: null,
          platform_username: instagramAccount.username,
        },
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?connected=true`
    );
  } catch (err) {
    console.error("Meta OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings?error=connection_failed`
    );
  }
}

async function getLongLivedToken(shortLivedToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID ?? "",
    client_secret: META_APP_SECRET ?? "",
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params}`
  );

  if (!response.ok) {
    throw new Error("Failed to get long-lived token");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function fetchPages(accessToken: string): Promise<
  Array<{ id: string; name: string }>
> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name",
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?${params}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch pages");
  }

  const data = (await response.json()) as {
    data: Array<{ id: string; name: string }>;
  };

  return data.data;
}

async function fetchInstagramAccount(
  pageId: string,
  accessToken: string
): Promise<{ id: string; username: string } | null> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "instagram_business_account",
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?${params}`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    instagram_business_account?: { id: string; username: string };
  };

  return data.instagram_business_account ?? null;
}
