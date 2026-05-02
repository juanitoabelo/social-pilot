import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe, stripePrices } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { plan } = body as { plan: string };

    if (!stripePrices[plan]) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_PLAN", message: "Invalid plan selected" } },
        { status: 400 }
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

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "NO_WORKSPACE", message: "No workspace found" } },
        { status: 400 }
      );
    }

    const workspaceId = user.workspaces[0].workspace_id;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePrices[plan],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/settings?canceled=true`,
      metadata: {
        workspace_id: workspaceId,
      },
    });

    return NextResponse.json({ data: { url: checkoutSession.url }, error: null });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create checkout session" } },
      { status: 500 }
    );
  }
}
