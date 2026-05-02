'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  Loader2,
  Download,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Sparkles,
  Clock,
} from 'lucide-react';
import Image from 'next/image';

interface AnalyticsData {
  summary: {
    total_posts: number;
    avg_engagement_rate: number;
    total_reach: number;
    total_impressions: number;
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_saves: number;
  };
  engagement_over_time: Array<{
    date: string;
    engagement_rate: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    impressions: number;
  }>;
  platforms: Array<{
    platform: string;
    posts: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    impressions: number;
    avg_engagement_rate: number;
  }>;
  top_posts: Array<{
    id: string;
    platform: string;
    caption: string;
    hashtags: string[];
    published_at: string;
    image_url: string | null;
    engagement_rate: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
  }>;
}

interface OptimalTimeSlot {
  dayOfWeek: number;
  dayName: string;
  hour: number;
  timeLabel: string;
  avgEngagementRate: number;
  postCount: number;
  platform: string;
  isEstimate?: boolean;
}

interface PlatformOptimalTimes {
  platform: string;
  slots: OptimalTimeSlot[];
  overallBestSlot: OptimalTimeSlot | null;
}

async function fetchAnalytics(days: number, platform?: string): Promise<AnalyticsData> {
  const params = new URLSearchParams({ days: days.toString() });
  if (platform) params.set('platform', platform);
  const res = await fetch(`/api/analytics?${params}`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function fetchOptimalTimes(): Promise<PlatformOptimalTimes[]> {
  const res = await fetch('/api/analytics/optimal-times');
  if (!res.ok) throw new Error('Failed to fetch optimal times');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

const timeRanges = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const platformIcons: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  twitter: 'X',
  linkedin: 'in',
  tiktok: 'TT',
  pinterest: 'PN',
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', days, platformFilter],
    queryFn: () => fetchAnalytics(days, platformFilter),
  });

  const { data: optimalTimes, isLoading: optimalTimesLoading } = useQuery({
    queryKey: ['optimal-posting-times'],
    queryFn: fetchOptimalTimes,
  });

  if (isLoading || !data) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your content performance</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  const { summary, engagement_over_time, platforms, top_posts } = data;

  if (summary.total_posts === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your content performance</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
          <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No analytics yet</h3>
          <p className="text-gray-500 mt-1 text-center max-w-md">
            Publish some posts to start seeing engagement metrics, trends, and performance insights here.
          </p>
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const headers = ['Platform', 'Caption', 'Published', 'Likes', 'Comments', 'Shares', 'Saves', 'Reach', 'Engagement Rate'];
    const rows = top_posts.map((p) => [
      p.platform,
      `"${p.caption.replace(/"/g, '""')}"`,
      new Date(p.published_at).toLocaleDateString(),
      p.likes,
      p.comments,
      p.shares,
      p.saves,
      p.reach,
      (p.engagement_rate * 100).toFixed(2) + '%',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 mt-1">Track your content performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  days === range.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {platformFilter && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtered by:</span>
          <span className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full capitalize">
            {platformFilter}
          </span>
          <button
            onClick={() => setPlatformFilter(undefined)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Posts"
          value={summary.total_posts.toString()}
          icon={BarChart3}
        />
        <StatCard
          label="Avg Engagement"
          value={`${(summary.avg_engagement_rate * 100).toFixed(2)}%`}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Reach"
          value={formatNumber(summary.total_reach)}
          icon={Users}
        />
        <StatCard
          label="Impressions"
          value={formatNumber(summary.total_impressions)}
          icon={Eye}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            Engagement Rate Over Time
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={engagement_over_time}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: unknown) => new Date(v as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v: unknown) => `${((v as number) * 100).toFixed(0)}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                labelFormatter={(v: unknown) => new Date(v as string).toLocaleDateString()}
                formatter={(value: unknown, name: string) => {
                  if (name === 'engagement_rate') return [`${((value as number) * 100).toFixed(2)}%`, 'Engagement Rate'];
                  return [value, name];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="engagement_rate"
                stroke="#0f172a"
                strokeWidth={2}
                dot={false}
                name="Engagement Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Posts by Platform</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={platforms}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="posts" fill="#0f172a" radius={[4, 4, 0, 0]} name="Posts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            Engagement Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Likes', value: summary.total_likes, icon: Heart, color: 'text-rose-500' },
              { label: 'Comments', value: summary.total_comments, icon: MessageCircle, color: 'text-blue-500' },
              { label: 'Shares', value: summary.total_shares, icon: Share2, color: 'text-green-500' },
              { label: 'Saves', value: summary.total_saves, icon: Bookmark, color: 'text-amber-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
                <span className="text-lg font-semibold">{formatNumber(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Platform Performance</h3>
          <div className="space-y-3">
            {platforms.map((p) => (
              <div
                key={p.platform}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setPlatformFilter(p.platform)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600">
                    {platformIcons[p.platform] || p.platform[0].toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium capitalize">{p.platform}</p>
                    <p className="text-xs text-gray-500">{p.posts} posts</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{(p.avg_engagement_rate * 100).toFixed(2)}%</p>
                  <p className="text-xs text-gray-500">avg engagement</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {optimalTimes && optimalTimes.length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-900">Best Posting Times</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {optimalTimes.map((platformData) => (
              <div key={platformData.platform} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        platformData.platform === 'instagram'
                          ? '#E1306C'
                          : platformData.platform === 'facebook'
                          ? '#1877F2'
                          : '#6B7280',
                    }}
                  />
                  <span className="text-sm font-medium capitalize">{platformData.platform}</span>
                  {platformData.overallBestSlot?.isEstimate && (
                    <span className="text-xs text-gray-400 ml-auto">industry defaults</span>
                  )}
                </div>
                {platformData.slots.map((slot, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2.5 rounded-lg ${
                      slot.isEstimate
                        ? 'bg-gray-50 border border-gray-100'
                        : i === 0
                        ? 'bg-amber-50 border border-amber-100'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {slot.dayName}
                      </span>
                      <span className="text-sm text-gray-600">{slot.timeLabel}</span>
                    </div>
                    {slot.postCount > 0 ? (
                      <span className="text-sm font-semibold text-primary">
                        {(slot.avgEngagementRate * 100).toFixed(1)}%
                        <span className="text-xs text-gray-400 font-normal ml-1">({slot.postCount} posts)</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">estimated</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Top 10 Posts by Engagement</h3>
        <div className="space-y-4">
          {top_posts.map((post, i) => (
            <div key={post.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50">
              <span className="text-lg font-bold text-gray-300 w-8 text-center">{i + 1}</span>
              {post.image_url && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  <Image
                    src={post.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 rounded capitalize">
                    {post.platform}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(post.published_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-900 line-clamp-2">{post.caption}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-primary">{(post.engagement_rate * 100).toFixed(2)}%</p>
                <p className="text-xs text-gray-500">{formatNumber(post.reach)} reach</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
