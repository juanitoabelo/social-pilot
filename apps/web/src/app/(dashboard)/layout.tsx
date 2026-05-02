import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
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

  const cookieStore = cookies();
  const preferredWorkspaceId = cookieStore.get("workspace_id")?.value;
  
  let currentWorkspace = user?.workspaces[0]?.workspace;
  
  if (preferredWorkspaceId && user?.workspaces) {
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
          workspaces={user?.workspaces.map(w => w.workspace) || []} 
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}