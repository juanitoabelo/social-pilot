import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-04-22.dahlia",
});

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    maxGenerations: 10,
    maxPlatforms: 1,
    maxScheduledPosts: 5,
  },
  solo: {
    name: "Solo",
    price: 29,
    maxGenerations: 100,
    maxPlatforms: 3,
    maxScheduledPosts: 50,
  },
  team: {
    name: "Team",
    price: 79,
    maxGenerations: 500,
    maxPlatforms: 6,
    maxScheduledPosts: 200,
  },
  agency: {
    name: "Agency",
    price: 199,
    maxGenerations: 999999,
    maxPlatforms: 6,
    maxScheduledPosts: 999999,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan];
}

export async function getStripeCustomerId(workspaceId: string): Promise<string | null> {
  return null;
}

export const stripePrices: Record<string, string> = {
  solo: process.env.STRIPE_PRICE_SOLO || "",
  team: process.env.STRIPE_PRICE_TEAM || "",
  agency: process.env.STRIPE_PRICE_AGENCY || "",
};
