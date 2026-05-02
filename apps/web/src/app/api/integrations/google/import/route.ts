import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis-client";
import { getGoogleAccessToken, getSheetTabs, readSheetData, normalizeColumnMapping } from "@worker/services/google-sheets/client";

const BULK_IMPORT_QUEUE = "bulk-import";

export async function GET(request: NextRequest) {
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
          select: { workspace_id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceId = user.workspaces[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No workspace" } },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get("spreadsheetId");
    const tabName = searchParams.get("tab");

    if (!spreadsheetId) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "spreadsheetId is required" } },
        { status: 400 }
      );
    }

    const accessToken = await getGoogleAccessToken(workspaceId);

    const tabs = await getSheetTabs(spreadsheetId, accessToken);
    const selectedTab = tabName || tabs[0]?.name;

    if (!selectedTab) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "No tabs found in spreadsheet" } },
        { status: 404 }
      );
    }

    const { headers, rows } = await readSheetData(
      spreadsheetId,
      selectedTab,
      accessToken
    );

    const columnMapping = normalizeColumnMapping(headers);

    return NextResponse.json({
      data: {
        headers,
        rows: rows.slice(0, 100),
        totalRows: rows.length,
        columnMapping,
        tab: selectedTab,
        tabs,
      },
      error: null,
    });
  } catch (error) {
    console.error("Read sheet data error:", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to read sheet data",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
          select: { workspace_id: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const workspaceId = user.workspaces[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No workspace" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      spreadsheetId,
      tab,
      columnMapping,
      defaultPlatform,
      scheduleMode,
    } = body as {
      spreadsheetId: string;
      tab: string;
      columnMapping: Record<string, string | null>;
      defaultPlatform: string;
      scheduleMode: "draft" | "scheduled" | "pending_review";
    };

    if (!spreadsheetId || !tab || !columnMapping) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "spreadsheetId, tab, and columnMapping are required" } },
        { status: 400 }
      );
    }

    if (!columnMapping.caption) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INPUT", message: "Caption column is required" } },
        { status: 400 }
      );
    }

    const accessToken = await getGoogleAccessToken(workspaceId);
    const { headers, rows } = await readSheetData(
      spreadsheetId,
      tab,
      accessToken
    );

    const connection = await getRedis();
    const queue = new Queue(BULK_IMPORT_QUEUE, { connection });

    await queue.add("bulk-import", {
      workspaceId,
      userId: user.id,
      spreadsheetId,
      tab,
      rows,
      columnMapping,
      defaultPlatform,
      scheduleMode: scheduleMode || "pending_review",
    }, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    await queue.close();

    return NextResponse.json({
      data: { success: true, totalRows: rows.length },
      error: null,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to start import",
        },
      },
      { status: 500 }
    );
  }
}
