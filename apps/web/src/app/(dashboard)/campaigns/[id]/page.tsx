'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Image, 
  Check,
  X,
  Trash2,
  RefreshCw,
  Edit2,
  Loader2,
  Copy,
  Shield,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateComplianceScore, getScoreColor, getScoreLabel } from '@/lib/compliance';

interface Asset {
  id: string;
  type: string;
  url: string;
  format: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
}

interface Post {
  id: string;
  platform: string;
  status: string;
  caption: string;
  hashtags: string[];
  cta: string | null;
  assets: Asset[];
}

interface Campaign {
  id: string;
  title: string;
  brief: string;
  status: string;
  platforms: string[];
  audience: Record<string, unknown>;
  brand_config: {
    tone?: string;
    do?: string[];
    dont?: string[];
    emoji_policy?: string;
  } | null;
  created_at: string;
  posts: Post[];
}

async function fetchCampaign(id: string): Promise<Campaign> {
  const res = await fetch(`/api/campaigns/${id}`);
  if (!res.ok) throw new Error('Failed to fetch campaign');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function generateCampaign(id: string) {
  const res = await fetch(`/api/campaigns/${id}/generate`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function updatePost(postId: string, action: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function patchPost(postId: string, updates: Record<string, unknown>) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState('');
  const [editedHashtags, setEditedHashtags] = useState<string[]>([]);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', params.id],
    queryFn: () => fetchCampaign(params.id),
    refetchInterval: (query) => {
      const c = query.state.data;
      return c?.status === 'generating' ? 3000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateCampaign(params.id),
    onSuccess: () => {
      toast.success('Content generation started');
      queryClient.invalidateQueries({ queryKey: ['campaign', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: (postId: string) => updatePost(postId, 'approve'),
    onSuccess: () => {
      toast.success('Post approved');
      queryClient.invalidateQueries({ queryKey: ['campaign', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (postId: string) => updatePost(postId, 'reject'),
    onSuccess: () => {
      toast.success('Post rejected');
      queryClient.invalidateQueries({ queryKey: ['campaign', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchMutation = useMutation({
    mutationFn: ({ postId, updates }: { postId: string; updates: Record<string, unknown> }) =>
      patchPost(postId, updates),
    onSuccess: () => {
      toast.success('Post updated');
      setEditingPostId(null);
      queryClient.invalidateQueries({ queryKey: ['campaign', params.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditedCaption(post.caption);
    setEditedHashtags([...post.hashtags]);
  };

  const handleCopyCaption = (caption: string, hashtags: string[]) => {
    const fullText = `${caption}\n\n${hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    toast.success('Caption copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-gray-500">Loading campaign...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">Campaign not found</p>
        <Link href="/dashboard/campaigns" className="mt-4 text-primary hover:underline">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      generating: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-500',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      generating: 'Generating...',
      ready: 'Ready',
      archived: 'Archived',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const platformColor = (platform: string) => {
    const colors: Record<string, string> = {
      instagram: 'bg-pink-100 text-pink-700',
      facebook: 'bg-blue-100 text-blue-700',
      linkedin: 'bg-blue-100 text-blue-800',
    };
    return colors[platform] || 'bg-gray-100 text-gray-700';
  };

  const posts = campaign.posts || [];
  const brandConfig = campaign.brand_config ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/campaigns" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.title}</h1>
              {statusBadge(campaign.status)}
            </div>
            <p className="text-gray-500 mt-1">
              {campaign.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
            </p>
          </div>
        </div>

        {campaign.status === 'draft' && (
          <button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {generateMutation.isPending ? 'Generating...' : 'Generate Content'}
          </button>
        )}

        {campaign.status === 'generating' && (
          <button disabled className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </button>
        )}
      </div>

      {campaign.brief && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Brief</h2>
          <p className="text-gray-900">{campaign.brief}</p>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
          <Image className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No content yet</h3>
          <p className="text-gray-500 mt-1">Generate content to start reviewing</p>
          {campaign.status === 'draft' && (
            <button 
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Content
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => {
            const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
            const compliance = calculateComplianceScore(post.caption, hashtags, brandConfig);
            const scoreColor = getScoreColor(compliance.score);
            const scoreLabel = getScoreLabel(compliance.score);

            return (
              <div key={post.id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platformColor(post.platform)}`}>
                        <span className="text-lg font-bold">{post.platform.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold capitalize">{post.platform} Post</h3>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                          post.status === 'approved' ? 'bg-green-100 text-green-700' :
                          post.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                          post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {post.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border ${scoreColor}`}>
                        {compliance.score >= 80 ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : compliance.score >= 60 ? (
                          <Shield className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        <span>{compliance.score}%</span>
                        <span className="opacity-70">{scoreLabel}</span>
                      </div>

                      <button
                        onClick={() => handleCopyCaption(post.caption, hashtags)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Copy caption"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {editingPostId === post.id ? (
                        <>
                          <button
                            onClick={() => patchMutation.mutate({ postId: post.id, updates: { caption: editedCaption, hashtags: editedHashtags } })}
                            disabled={patchMutation.isPending}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                          >
                            {patchMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        post.status === 'pending_review' && (
                          <button
                            onClick={() => handleEditPost(post)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {compliance.violations.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-red-700 font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Compliance Issues ({compliance.violations.length})
                      </div>
                      <ul className="text-xs text-red-600 space-y-0.5">
                        {compliance.violations.map((v, i) => (
                          <li key={i}>• {v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {post.assets.length > 0 && (
                    <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={post.assets[0].url}
                        alt={post.assets[0].alt_text || 'Generated image'}
                        className="w-full max-h-80 object-cover"
                      />
                    </div>
                  )}

                  {editingPostId === post.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Caption</label>
                        <textarea
                          value={editedCaption}
                          onChange={(e) => setEditedCaption(e.target.value)}
                          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Hashtags</label>
                        <input
                          type="text"
                          value={editedHashtags.join(' ')}
                          onChange={(e) => {
                            const tags = e.target.value
                              .split(' ')
                              .filter(tag => tag.length > 0)
                              .map(tag => tag.startsWith('#') ? tag : `#${tag}`);
                            setEditedHashtags(tags);
                          }}
                          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="#hashtag1 #hashtag2"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-900 whitespace-pre-wrap">{post.caption}</p>
                      {hashtags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {hashtags.map((tag) => (
                            <span key={tag} className="text-sm text-primary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {editingPostId !== post.id && post.status === 'pending_review' && (
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t">
                      <button
                        onClick={() => approveMutation.mutate(post.id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(post.id)}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
