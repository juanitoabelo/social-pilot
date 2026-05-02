'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Loader2,
  ExternalLink,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { GoogleSheetsImportModal } from '@/components/campaigns/google-sheets-import';

interface Campaign {
  id: string;
  title: string;
  brief: string;
  status: string;
  platforms: string[];
  created_at: string;
}

async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch('/api/campaigns');
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data || [];
}

async function generateCampaign(id: string) {
  const res = await fetch(`/api/campaigns/${id}/generate`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function deleteCampaign(id: string) {
  const res = await fetch(`/api/campaigns/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showGoogleImport, setShowGoogleImport] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      toast.success('Google Sheets connected');
      setShowGoogleImport(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => generateCampaign(id),
    onSuccess: () => {
      toast.success('Content generation started');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onMutate: (id) => setDeleting(id),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setDeleting(null),
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      generating: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-500',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      generating: 'Generating',
      ready: 'Ready',
      archived: 'Archived',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-gray-500 mt-1">Create and manage your content campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGoogleImport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import from Sheets</span>
          </button>
          <Link 
            href="/dashboard/campaigns/new" 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="mt-4 text-gray-500">Loading campaigns...</p>
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border">
          <Megaphone className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="text-gray-500 mt-1">Create your first campaign to get started</p>
          <Link 
            href="/dashboard/campaigns/new" 
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-xl border p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold">{campaign.title}</h2>
                    {statusBadge(campaign.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {campaign.brief || 'No brief added'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1.5">
                      {campaign.platforms?.map((platform: string) => (
                        <span key={platform} className="bg-gray-100 px-2 py-0.5 rounded text-xs capitalize">
                          {platform}
                        </span>
                      ))}
                    </div>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  
                  {campaign.status === 'draft' && (
                    <button 
                      onClick={() => generateMutation.mutate(campaign.id)}
                      disabled={generateMutation.isPending || deleting === campaign.id}
                      className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg disabled:opacity-50"
                    >
                      Generate
                    </button>
                  )}
                  
                  <button 
                    onClick={() => deleteMutation.mutate(campaign.id)}
                    disabled={deleteMutation.isPending || deleting === campaign.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    {deleting === campaign.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showGoogleImport && (
        <GoogleSheetsImportModal onClose={() => setShowGoogleImport(false)} />
      )}
    </div>
  );
}
