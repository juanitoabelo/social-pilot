import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (
      retries > 0 &&
      error instanceof Error &&
      (error.message.includes("terminating connection") ||
       error.message.includes("connection") ||
       error.message.includes("timeout"))
    ) {
      console.log(`[Register] DB connection failed, retrying (${retries} left)...`);
      await new Promise((r) => setTimeout(r, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await withRetry(() =>
      prisma.user.findUnique({ where: { email } })
    );

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await withRetry(() =>
      prisma.user.create({
        data: { email, name, password: hashedPassword },
      })
    );

    await withRetry(() =>
      prisma.workspace.create({
        data: {
          name: `${name || "My"}'s Workspace`,
          slug: `workspace-${user.id.slice(0, 8)}`,
          brand_config: {
            brand_name: "My Brand",
            tone: "professional",
            do: ["Be helpful"],
            dont: ["Be spammy"],
            hashtag_style: "lowercase",
            emoji_policy: "optional",
          },
          members: {
            create: {
              user_id: user.id,
              role: "owner",
            },
          },
        },
      })
    );

    return NextResponse.json({ success: true, user: { email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Database connection failed. Please try again." },
      { status: 500 }
    );
  }
}