"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Link2, Palette, Plus, X, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface Workspace {
  id: string;
  name: string;
  brand_config: unknown;
  platform_connections: Array<{
    id: string;
    platform: string;
    platform_username: string | null;
  }>;
  members: Member[];
}

async function fetchMembers(workspaceId: string): Promise<Member[]> {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

async function inviteMember(workspaceId: string, email: string, role: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function removeMember(workspaceId: string, memberId: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function changeRole(workspaceId: string, memberId: string, role: string) {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, role }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

export default function SettingsClient({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ["members", workspace.id],
    queryFn: () => fetchMembers(workspace.id),
    initialData: workspace.members,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      inviteMember(workspace.id, email, role),
    onSuccess: (data) => {
      toast.success(`${data.user.email} added to workspace`);
      queryClient.invalidateQueries({ queryKey: ["members", workspace.id] });
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: ({ memberId, email }: { memberId: string; email: string }) =>
      removeMember(workspace.id, memberId).then(() => ({ memberId, email })),
    onSuccess: ({ email }) => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["members", workspace.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      changeRole(workspace.id, memberId, role),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["members", workspace.id] });
      setRoleDropdownOpen(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const brandConfig = (workspace.brand_config as Record<string, unknown>) || {};
  const connections = workspace.platform_connections || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Brand Configuration</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Brand Name</p>
              <p className="font-medium">{(brandConfig.brand_name as string) || "Not set"}</p>
            </div>
            <div>
              <p className="text-gray-500">Tone</p>
              <p className="font-medium capitalize">{(brandConfig.tone as string) || "Not set"}</p>
            </div>
            <div>
              <p className="text-gray-500">Hashtag Style</p>
              <p className="font-medium">{(brandConfig.hashtag_style as string) || "Not set"}</p>
            </div>
            <div>
              <p className="text-gray-500">Emoji Policy</p>
              <p className="font-medium">{(brandConfig.emoji_policy as string) || "Not set"}</p>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Edit your brand configuration in your workspace settings.
          </p>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Link2 className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Connected Platforms</h2>
          </div>
          
          {connections.length === 0 ? (
            <p className="text-gray-500 text-sm">No platforms connected yet.</p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium capitalize">{conn.platform}</span>
                  <span className="text-sm text-gray-500">{conn.platform_username || "Connected"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold">Team Members</h2>
            </div>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20"
            >
              <Plus className="w-4 h-4" />
              Invite Member
            </button>
          </div>
          
          {(!members || members.length === 0) ? (
            <p className="text-gray-500 text-sm">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{member.user.name || member.user.email}</p>
                    <p className="text-xs text-gray-500">{member.user.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdownOpen(roleDropdownOpen === member.id ? null : member.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border rounded hover:bg-gray-100"
                      >
                        {member.role}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      
                      {roleDropdownOpen === member.id && (
                        <div className="absolute right-0 mt-1 w-32 bg-white border rounded-lg shadow-lg z-10">
                          {["owner", "admin", "member"].map((role) => (
                            <button
                              key={role}
                              onClick={() => roleMutation.mutate({ memberId: member.id, role })}
                              className={`w-full text-left px-3 py-2 text-sm capitalize hover:bg-gray-100 rounded ${
                                member.role === role ? "bg-primary/10 text-primary" : ""
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => removeMutation.mutate({ memberId: member.id, email: member.user.email })}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isInviteOpen && (
        <div className="fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setIsInviteOpen(false)} 
          />
          <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-lg">
            <div className="bg-white rounded-lg border shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Invite Team Member</h2>
                <button 
                  onClick={() => setIsInviteOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleInvite}>
                <div className="mb-4">
                  <label htmlFor="invite-email" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    User must have an account to be invited
                  </p>
                </div>

                <div className="mb-4">
                  <label htmlFor="invite-role" className="block text-sm font-medium mb-1">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending || !inviteEmail.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {inviteMutation.isPending ? "Inviting..." : "Invite Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
