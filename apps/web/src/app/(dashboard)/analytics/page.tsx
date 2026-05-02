'use client';

import { BarChart3, TrendingUp, Users, Eye } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-gray-500 mt-1">Track your content performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Posts', value: '0', icon: BarChart3 },
          { label: 'Avg Engagement', value: '0%', icon: TrendingUp },
          { label: 'Total Reach', value: '0', icon: Users },
          { label: 'Impressions', value: '0', icon: Eye },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className="w-8 h-8 text-gray-300" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
        <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Analytics coming soon</h3>
        <p className="text-gray-500 mt-1 text-center max-w-md">
          Once you start publishing posts, you'll see engagement metrics, trends, and AI-powered insights here.
        </p>
      </div>
    </div>
  );
}
