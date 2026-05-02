"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Link2, Palette, Plus, X, Trash2, ChevronDown, ExternalLink, CheckCircle2 } from "lucide-react";
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
    connected_at: string;
  }>;
  members: Member[];
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

async function disconnectPlatform(workspaceId: string, platform: string) {
  const res = await fetch(
    `/api/platforms?workspaceId=${workspaceId}&platform=${platform}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

const platforms = [
  {
    key: "instagram",
    name: "Instagram",
    color: "#E1306C",
    description: "Connect your Instagram Business account to publish posts automatically",
    requirements: ["Instagram Business account", "Linked to a Facebook Page"],
  },
  {
    key: "facebook",
    name: "Facebook",
    color: "#1877F2",
    description: "Connect your Facebook Page to publish posts and track engagement",
    requirements: ["Facebook Page with admin access"],
  },
];

export default function SettingsClient({ workspace }: { workspace: Workspace }) {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const connections = workspace.platform_connections || [];
  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("Platform connected successfully");
      queryClient.invalidateQueries({ queryKey: ["settings", workspace.id] });
      window.history.replaceState({}, "", window.location.pathname);
    }
    const error = params.get("error");
    if (error) {
      toast.error(`Connection failed: ${error.replace(/_/g, " ")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient, workspace.id]);

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

  const disconnectMutation = useMutation({
    mutationFn: ({ workspaceId, platform }: { workspaceId: string; platform: string }) =>
      disconnectPlatform(workspaceId, platform),
    onSuccess: (_, { platform }) => {
      toast.success(`${platform} disconnected`);
      setDisconnecting(null);
      queryClient.invalidateQueries({ queryKey: ["settings", workspace.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDisconnecting(null);
    },
  });

  const handleConnect = (platform: string) => {
    window.location.href = `/api/platforms/meta/connect`;
  };

  const handleDisconnect = (platform: string) => {
    setDisconnecting(platform);
    disconnectMutation.mutate({ workspaceId: workspace.id, platform });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const brandConfig = (workspace.brand_config as Record<string, unknown>) || {};

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
          <div className="flex items-center gap-3 mb-6">
            <Link2 className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Social Accounts</h2>
          </div>

          <div className="space-y-4">
            {platforms.map((platform) => {
              const isConnected = connectedPlatforms.has(platform.key);
              const connection = connections.find((c) => c.platform === platform.key);

              return (
                <div
                  key={platform.key}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: platform.color }}
                      >
                        {platform.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{platform.name}</h3>
                          {isConnected && (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{platform.description}</p>
                        {connection?.platform_username && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Connected as @{connection.platform_username}
                          </p>
                        )}
                      </div>
                    </div>

                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(platform.key)}
                        disabled={disconnecting === platform.key}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        {disconnecting === platform.key ? "..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.key)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg hover:opacity-90"
                        style={{ backgroundColor: platform.color }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Connect
                      </button>
                    )}
                  </div>

                  {isConnected && connection && (
                    <div className="px-4 pb-3 text-xs text-gray-400">
                      Connected {new Date(connection.connected_at).toLocaleDateString()}
                    </div>
                  )}

                  {!isConnected && (
                    <div className="px-4 pb-3 border-t bg-gray-50">
                      <p className="text-xs text-gray-500 mt-2 mb-1">Requirements:</p>
                      <ul className="text-xs text-gray-400 space-y-0.5">
                        {platform.requirements.map((req, i) => (
                          <li key={i}>• {req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

          {(!workspace.members || workspace.members.length === 0) ? (
            <p className="text-gray-500 text-sm">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {workspace.members.map((member) => (
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
