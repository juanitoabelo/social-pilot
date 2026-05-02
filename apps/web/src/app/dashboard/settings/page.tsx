import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsClient from "./settings-client";
import { PLANS } from "@/lib/stripe";
import type { PlanKey } from "@/lib/stripe";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  const workspace = user?.workspaces[0]?.workspace;

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  const connections = await prisma.platformConnection.findMany({
    where: { workspace_id: workspace.id },
  });

  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: workspace.id },
    include: { user: true },
  });

  return (
    <SettingsClient
      workspace={{
        ...workspace,
        platform_connections: connections,
        members,
      }}
      subscription={{
        plan: (workspace.subscription_plan as PlanKey) || "free",
        status: workspace.subscription_status || "none",
        endsAt: workspace.subscription_ends_at,
        generationsUsed: workspace.ai_generations_this_month,
        limits: PLANS[(workspace.subscription_plan as PlanKey) || "free"],
      }}
    />
  );
}
