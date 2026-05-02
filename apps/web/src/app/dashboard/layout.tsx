import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/topbar";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
