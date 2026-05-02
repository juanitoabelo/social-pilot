import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    await prisma.workspace.create({
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
    });

    return NextResponse.json({ success: true, user: { email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}