"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircle, CheckCircle, XCircle, Calendar, Upload, AlertTriangle, UserPlus, UserMinus, Settings, Loader2 } from "lucide-react";

type ActivityLog = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  user: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

const actionConfig: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
  comment_added: { icon: MessageCircle, label: "Commented", color: "text-blue-600" },
  post_approved: { icon: CheckCircle, label: "Approved post", color: "text-green-600" },
  post_rejected: { icon: XCircle, label: "Rejected post", color: "text-red-600" },
  post_scheduled: { icon: Calendar, label: "Scheduled post", color: "text-purple-600" },
  post_published: { icon: Upload, label: "Published post", color: "text-indigo-600" },
  post_failed: { icon: AlertTriangle, label: "Post failed", color: "text-orange-600" },
  member_invited: { icon: UserPlus, label: "Invited member", color: "text-teal-600" },
  member_removed: { icon: UserMinus, label: "Removed member", color: "text-rose-600" },
  settings_updated: { icon: Settings, label: "Updated settings", color: "text-gray-600" },
};

function getActionDetails(action: string) {
  return actionConfig[action] || { icon: MessageCircle, label: action.replace(/_/g, " "), color: "text-gray-600" };
}

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityLogPage() {
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const res = await fetch("/api/activity-log?limit=100");
      const json = await res.json();
      return json.data || [];
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-gray-500 mt-1">Track all actions across your workspace</p>
      </div>

      <div className="bg-white rounded-xl border">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No activity yet</h3>
            <p className="text-gray-500 mt-1">Actions will appear here as your team works</p>
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <div className="divide-y">
            {logs.map((log) => {
              const { icon: Icon, label, color } = getActionDetails(log.action);
              const platform = (log.metadata?.platform as string) || "";
              const variantLabel = (log.metadata?.variant_label as string) || "";
              const detail = [platform && `on ${platform}`, variantLabel && `variant ${variantLabel}`]
                .filter(Boolean)
                .join(" ");

              return (
                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.user.name || log.user.email}
                      </span>
                      <span className="text-sm text-gray-500">{label}</span>
                      {detail && (
                        <span className="text-sm text-gray-400">{detail}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTimeAgo(log.created_at)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {getInitials(log.user.name, log.user.email)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
