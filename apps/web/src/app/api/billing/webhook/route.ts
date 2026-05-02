import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id;
      if (!workspaceId) break;

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        },
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = subscription.customer as string;

      const workspace = await prisma.workspace.findFirst({
        where: { stripe_customer_id: customerId },
      });
      if (!workspace) break;

      const items = subscription.items as { data: Array<{ price: { id: string } }> } | undefined;
      const priceId = items?.data?.[0]?.price?.id;
      const plan = getPlanFromPriceId(priceId || "");

      const endedAt = subscription.ended_at as number | null | undefined;
      const currentPeriodEnd = subscription.current_period_end as number | null | undefined;

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          stripe_subscription_id: subscription.id as string,
          subscription_plan: plan,
          subscription_status: subscription.status as string,
          subscription_ends_at: endedAt
            ? new Date(endedAt * 1000)
            : currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000)
              : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as Record<string, unknown>;
      const customerId = subscription.customer as string;

      const workspace = await prisma.workspace.findFirst({
        where: { stripe_customer_id: customerId },
      });
      if (!workspace) break;

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          subscription_plan: "free",
          subscription_status: "canceled",
          stripe_subscription_id: null,
          subscription_ends_at: null,
        },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const customerId = invoice.customer as string;

      const workspace = await prisma.workspace.findFirst({
        where: { stripe_customer_id: customerId },
      });
      if (!workspace) break;

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { subscription_status: "past_due" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function getPlanFromPriceId(priceId: string): string {
  const mapping: Record<string, string> = {
    [process.env.STRIPE_PRICE_SOLO || ""]: "solo",
    [process.env.STRIPE_PRICE_TEAM || ""]: "team",
    [process.env.STRIPE_PRICE_AGENCY || ""]: "agency",
  };
  return mapping[priceId] || "solo";
}
