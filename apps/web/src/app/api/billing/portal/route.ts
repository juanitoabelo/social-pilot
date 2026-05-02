import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

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

    if (!user || user.workspaces.length === 0) {
      return NextResponse.json(
        { data: null, error: { code: "NO_WORKSPACE", message: "No workspace found" } },
        { status: 400 }
      );
    }

    const workspaceId = user.workspaces[0].workspace_id;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { stripe_customer_id: true },
    });

    if (!workspace?.stripe_customer_id) {
      return NextResponse.json(
        { data: null, error: { code: "NO_CUSTOMER", message: "No Stripe customer found" } },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
    });

    return NextResponse.json({ data: { url: portalSession.url }, error: null });
  } catch (error) {
    console.error("Create portal session error:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create portal session" } },
      { status: 500 }
    );
  }
}
