"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, User, LogOut, Plus, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface TopBarProps {
  workspace: Workspace | null | undefined;
  workspaces: Workspace[];
}

export function TopBar({ workspace, workspaces }: TopBarProps) {
  const router = useRouter();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleWorkspaceSwitch = (ws: Workspace) => {
    setIsWorkspaceOpen(false);
    document.cookie = `workspace_id=${ws.id}; path=/; max-age=31536000`;
    router.refresh();
    toast.success(`Switched to ${ws.name}`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      const data = await res.json();
      
      if (data.error) {
        toast.error(data.error.message);
        return;
      }

      toast.success("Workspace created!");
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      router.refresh();
    } catch (error) {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6 lg:pl-64">
      <div className="relative">
        <button
          onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <span className="font-medium">{workspace?.name || "Select Workspace"}</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
        
        {isWorkspaceOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-50">
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 px-2 py-1">Workspaces</p>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceSwitch(ws)}
                  className={`w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded ${
                    workspace?.id === ws.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  {ws.name}
                </button>
              ))}
            </div>
            <div className="border-t p-2">
              <button 
                onClick={() => {
                  setIsWorkspaceOpen(false);
                  setIsCreateDialogOpen(true);
                }}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-primary hover:bg-gray-100 rounded"
              >
                <Plus className="w-4 h-4" />
                Create Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setIsUserOpen(!isUserOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {isUserOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>

      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsCreateDialogOpen(false)} 
          />
          <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-lg">
            <div className="bg-white rounded-lg border shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Create Workspace</h2>
                <button 
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleCreateWorkspace}>
                <div className="mb-4">
                  <label htmlFor="workspace-name" className="block text-sm font-medium mb-1">
                    Workspace Name
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g., Acme Corp"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This is how your workspace will appear to team members
                  </p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newWorkspaceName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Workspace"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
