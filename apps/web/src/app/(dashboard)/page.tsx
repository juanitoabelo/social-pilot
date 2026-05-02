import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Megaphone, Image, Calendar, Plus, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      workspaces: {
        include: {
          workspace: {
            include: {
              campaigns: {
                take: 5,
                orderBy: { created_at: "desc" },
              },
              platform_connections: true,
            },
          },
        },
      },
    },
  });

  const workspace = user?.workspaces[0]?.workspace;
  const campaigns = workspace?.campaigns || [];
  const connections = workspace?.platform_connections || [];

  const stats = {
    totalCampaigns: campaigns.length,
    totalPosts: 0, // Would need to join with posts
    connectedPlatforms: connections.length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Campaigns</p>
              <p className="text-3xl font-bold">{stats.totalCampaigns}</p>
            </div>
            <Megaphone className="w-10 h-10 text-primary/20" />
          </div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Posts</p>
              <p className="text-3xl font-bold">{stats.totalPosts}</p>
            </div>
            <Image className="w-10 h-10 text-primary/20" />
          </div>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Connected Platforms</p>
              <p className="text-3xl font-bold">{stats.connectedPlatforms}</p>
            </div>
            <Calendar className="w-10 h-10 text-primary/20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Recent Campaigns</h2>
          <Link href="/dashboard/campaigns" className="text-sm text-primary flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No campaigns yet</p>
            <Link
              href="/dashboard/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="flex items-center justify-between p-6 hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-medium">{campaign.title}</h3>
                  <p className="text-sm text-gray-500">{(campaign.brief as string)?.slice(0, 100) || "No brief"}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  campaign.status === "ready" ? "bg-green-100 text-green-700" :
                  campaign.status === "generating" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {campaign.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}