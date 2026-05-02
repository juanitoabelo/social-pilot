import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";

async function getSessionUserId(): Promise<string | null> {
  const cookieStore = cookies();
  const possibleNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];

  for (const name of possibleNames) {
    const cookie = cookieStore.get(name);
    if (!cookie?.value) continue;

    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
      const { payload } = await jwtVerify(cookie.value, secret);
      return payload.sub as string | null;
    } catch {
      continue;
    }
  }
  return null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const cookieStore = cookies();
  const preferredWorkspaceId = cookieStore.get("workspace_id")?.value;
  
  let currentWorkspace = user.workspaces[0]?.workspace;
  
  if (preferredWorkspaceId) {
    const preferred = user.workspaces.find(
      (w) => w.workspace.id === preferredWorkspaceId
    );
    if (preferred) {
      currentWorkspace = preferred.workspace;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar 
          workspace={currentWorkspace} 
          workspaces={user.workspaces.map(w => w.workspace)} 
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
