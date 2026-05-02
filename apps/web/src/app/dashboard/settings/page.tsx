import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsClient from "./settings-client";

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
          workspace: {
            include: {
              platform_connections: true,
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const workspace = user?.workspaces[0]?.workspace;

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  return <SettingsClient workspace={workspace} />;
}
