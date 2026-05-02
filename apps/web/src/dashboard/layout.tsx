import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  
  const sessionCookie = cookieStore.get("authjs.session-token")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  let userId: string | undefined;
  
  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(sessionCookie, secret);
    userId = payload.sub as string | undefined;
  } catch {
    redirect("/login");
  }

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
