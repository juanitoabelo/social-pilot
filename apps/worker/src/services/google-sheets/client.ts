import { prisma } from "../../lib/prisma";
import { decrypt, encrypt } from "../../lib/crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set");
  return key;
}

export async function getGoogleAccessToken(workspaceId: string): Promise<string> {
  const connection = await prisma.platformConnection.findFirst({
    where: {
      workspace_id: workspaceId,
      platform: "google_sheets",
    },
  });

  if (!connection) {
    throw new Error("Google Sheets not connected for this workspace");
  }

  let accessToken = decrypt(connection.access_token, getEncryptionKey());

  if (connection.token_expires_at && connection.token_expires_at < new Date()) {
    const refreshToken = decrypt(connection.refresh_token!, getEncryptionKey());
    const newTokens = await refreshGoogleToken(refreshToken);

    accessToken = newTokens.access_token;

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        access_token: encryptToken(newTokens.access_token),
        refresh_token: newTokens.refresh_token
          ? encryptToken(newTokens.refresh_token)
          : connection.refresh_token,
        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
      },
    });
  }

  return accessToken;
}

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID ?? "",
    client_secret: GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google token");
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

function encryptToken(token: string): string {
  return require("../lib/crypto").encrypt(token, getEncryptionKey());
}

export async function listSpreadsheets(accessToken: string): Promise<
  Array<{ id: string; name: string; modifiedTime: string }>
> {
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id,name,modifiedTime)",
        orderBy: "modifiedTime desc",
        pageSize: "50",
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to list Google Sheets");
  }

  const data = (await response.json()) as {
    files: Array<{ id: string; name: string; modifiedTime: string }>;
  };

  return data.files;
}

export async function getSheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<Array<{ name: string; gid: string }>> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,gridProperties))`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get sheet tabs");
  }

  const data = (await response.json()) as {
    sheets: Array<{
      properties: { title: string; gridProperties: { rowCount: number } };
    }>;
  };

  return data.sheets
    .filter((s) => s.properties.gridProperties.rowCount > 1)
    .map((s) => ({
      name: s.properties.title,
      gid: s.properties.title,
    }));
}

export type SheetRow = {
  row: Record<string, string>;
  rowIndex: number;
};

export async function readSheetData(
  spreadsheetId: string,
  range: string,
  accessToken: string
): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to read sheet data");
  }

  const data = (await response.json()) as {
    values: string[][];
  };

  if (!data.values || data.values.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = data.values[0].map((h) => h.trim().toLowerCase());
  const rows: SheetRow[] = [];

  for (let i = 1; i < data.values.length; i++) {
    const rowValues = data.values[i];
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = rowValues[idx] || "";
    });
    rows.push({ row, rowIndex: i });
  }

  return { headers, rows };
}

export function normalizeColumnMapping(
  headers: string[]
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {
    date: null,
    time: null,
    platform: null,
    caption: null,
    hashtags: null,
    media_url: null,
    status: null,
    variant: null,
  };

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (normalized.includes("date") || normalized === "date") mapping.date = header;
    else if (normalized.includes("time") || normalized === "time") mapping.time = header;
    else if (normalized.includes("platform") || normalized.includes("channel") || normalized.includes("network")) mapping.platform = header;
    else if (normalized.includes("caption") || normalized.includes("copy") || normalized.includes("text") || normalized.includes("post")) mapping.caption = header;
    else if (normalized.includes("hashtag") || normalized.includes("tag")) mapping.hashtags = header;
    else if (normalized.includes("media") || normalized.includes("image") || normalized.includes("photo") || normalized.includes("url") || normalized.includes("link")) mapping.media_url = header;
    else if (normalized.includes("status") || normalized.includes("state")) mapping.status = header;
    else if (normalized.includes("variant") || normalized.includes("ab") || normalized.includes("test")) mapping.variant = header;
  }

  return mapping;
}
