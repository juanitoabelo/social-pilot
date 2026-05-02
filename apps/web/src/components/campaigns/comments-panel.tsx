"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
};

export function CommentsPanel({ postId }: { postId: string }) {
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const json = await res.json();
      return json.data || [];
    },
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      setNewComment("");
    },
  });

  const formatTime = (dateStr: string) => {
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
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-medium text-sm">Comments ({comments.length})</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
        )}

        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-primary">
                {getInitials(comment.user.name, comment.user.email)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-gray-900">
                  {comment.user.name || comment.user.email}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-700 break-words">{comment.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newComment.trim() && !addComment.isPending) {
              addComment.mutate(newComment.trim());
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            disabled={addComment.isPending}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || addComment.isPending}
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addComment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
