'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image, Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Post {
  id: string;
  platform: string;
  status: string;
  caption: string;
  hashtags: string[];
  assets: Array<{ url: string }>;
  campaign: { title: string };
  created_at: string;
}

async function fetchPosts(): Promise<Post[]> {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('Failed to fetch posts');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

export default function ContentLibraryPage() {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const filtered = (posts || []).filter((post) => {
    const matchesSearch = search === '' || post.caption.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || post.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="mt-4 text-gray-500">Loading content...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <p className="text-gray-500 mt-1">Browse and search all your generated content</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search captions..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
          <Image className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No content found</h3>
          <p className="text-gray-500 mt-1">
            {(posts?.length ?? 0) === 0 ? 'Generate some campaigns to see content here' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-shadow">
              {post.assets.length > 0 && (
                <div className="aspect-video bg-gray-100">
                  <img
                    src={post.assets[0].url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium capitalize px-2 py-0.5 rounded bg-gray-100">
                    {post.platform}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    post.status === 'approved' ? 'bg-green-100 text-green-700' :
                    post.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                    post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {post.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{post.caption}</p>
                <p className="text-xs text-gray-400">{post.campaign?.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
