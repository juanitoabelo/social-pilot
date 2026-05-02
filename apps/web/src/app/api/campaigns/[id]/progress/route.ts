import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getRedisClient } from "@packages/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const campaignId = params.id;
  const redis = getRedisClient();

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(":heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      const poll = async () => {
        try {
          const progress = await redis.get(`job:${campaignId}:progress`);
          const status = await redis.get(`job:${campaignId}:status`);
          const message = await redis.get(`job:${campaignId}:message`);

          if (progress || status || message) {
            const data = JSON.stringify({
              progress: progress ? parseInt(progress, 10) : 0,
              status: status ?? "unknown",
              message: message ?? "",
            });
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          }

          if (status === "completed" || status === "failed") {
            clearInterval(heartbeat);
            controller.close();
          }
        } catch (error) {
          console.error("[SSE] Polling error:", error);
        }
      };

      const interval = setInterval(() => {
        poll().catch(console.error);
      }, 500);

      poll().catch(console.error);

      return () => {
        clearInterval(heartbeat);
        clearInterval(interval);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
