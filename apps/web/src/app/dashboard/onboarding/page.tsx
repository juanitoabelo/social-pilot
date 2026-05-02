'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sparkles,
  Palette,
  Link2,
  Megaphone,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from 'lucide-react';

const steps = [
  { id: 1, title: 'Workspace Setup', icon: Palette },
  { id: 2, title: 'Connect Platform', icon: Link2 },
  { id: 3, title: 'First Campaign', icon: Megaphone },
];

const sampleBrief = `Share our latest product launch with our target audience. Focus on the key benefits: time savings, ease of use, and professional results. Keep it conversational and engaging.`;

const toneOptions = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'humorous', label: 'Humorous', emoji: '😄' },
  { value: 'inspirational', label: 'Inspirational', emoji: '✨' },
  { value: 'educational', label: 'Educational', emoji: '📚' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  const [workspaceName, setWorkspaceName] = useState('');
  const [brandTone, setBrandTone] = useState('professional');
  const [hashtagStyle, setHashtagStyle] = useState('lowercase');
  const [emojiPolicy, setEmojiPolicy] = useState('optional');
  const [connectPlatform, setConnectPlatform] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBrief, setCampaignBrief] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const setupWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/workspaces/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceName,
          brandConfig: {
            brand_name: workspaceName,
            tone: brandTone,
            hashtag_style: hashtagStyle,
            emoji_policy: emojiPolicy,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.data;
    },
    onSuccess: () => {
      setCurrentStep(2);
      toast.success('Workspace created!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle || 'My First Campaign',
          brief: campaignBrief || sampleBrief,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram'],
          audience: {},
          useBrandConfig: true,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.data;
    },
    onSuccess: (data) => {
      toast.success('Campaign created!');
      fetch(`/api/campaigns/${data.id}/generate`, { method: 'POST' }).catch(() => {});
      toast.success('Content generation started');
      router.push('/dashboard');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleNext = () => {
    if (currentStep === 1) {
      if (!workspaceName.trim()) {
        toast.error('Please enter a workspace name');
        return;
      }
      setupWorkspaceMutation.mutate();
    } else if (currentStep === 2) {
      if (connectPlatform === 'instagram' || connectPlatform === 'facebook') {
        window.location.href = `/api/platforms/meta/connect`;
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      createCampaignMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSkipConnect = () => {
    setCurrentStep(3);
  };

  const StepIcon = steps[currentStep - 1]?.icon || Sparkles;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">SocialPilot</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Let's get you set up</h1>
          <p className="text-slate-500 mt-1">Three quick steps to start automating your social media</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.id < currentStep
                    ? 'bg-emerald-500 text-white'
                    : step.id === currentStep
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {step.id < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </div>
              {step.id < 3 && (
                <div
                  className={`w-16 h-0.5 mx-2 transition-colors ${
                    step.id < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <StepIcon className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold">{steps[currentStep - 1]?.title}</h2>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="workspace-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Workspace / Brand Name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., Acme Co."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Brand Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {toneOptions.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setBrandTone(tone.value)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                        brandTone === tone.value
                          ? 'border-slate-900 bg-slate-50 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span>{tone.emoji}</span>
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hashtag-style" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Hashtag Style
                  </label>
                  <select
                    id="hashtag-style"
                    value={hashtagStyle}
                    onChange={(e) => setHashtagStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="lowercase">lowercase</option>
                    <option value="camelcase">CamelCase</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="emoji-policy" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Emoji Policy
                  </label>
                  <select
                    id="emoji-policy"
                    value={emojiPolicy}
                    onChange={(e) => setEmojiPolicy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="optional">Optional</option>
                    <option value="required">Always include</option>
                    <option value="none">Never use</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Connect your social accounts to publish posts automatically. You can skip this and connect later in Settings.
              </p>

              <div className="space-y-2">
                {[
                  { key: 'instagram', name: 'Instagram', color: '#E1306C', icon: 'IG' },
                  { key: 'facebook', name: 'Facebook', color: '#1877F2', icon: 'FB' },
                ].map((platform) => (
                  <button
                    key={platform.key}
                    onClick={() => setConnectPlatform(platform.key)}
                    className={`w-full flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                      connectPlatform === platform.key
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{platform.name}</p>
                      <p className="text-xs text-slate-500">Business account</p>
                    </div>
                    {connectPlatform === platform.key && (
                      <Check className="w-5 h-5 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSkipConnect}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Skip — I'll connect later
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Create your first campaign. We've pre-filled a sample brief — feel free to edit it.
              </p>

              <div>
                <label htmlFor="campaign-title" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Campaign Title
                </label>
                <input
                  id="campaign-title"
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g., Summer Product Launch"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="campaign-brief" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Campaign Brief
                </label>
                <textarea
                  id="campaign-brief"
                  value={campaignBrief}
                  onChange={(e) => setCampaignBrief(e.target.value)}
                  placeholder={sampleBrief}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Platforms
                </label>
                <div className="flex gap-2">
                  {['instagram', 'facebook'].map((platform) => (
                    <button
                      key={platform}
                      onClick={() =>
                        setSelectedPlatforms((prev) =>
                          prev.includes(platform)
                            ? prev.filter((p) => p !== platform)
                            : [...prev, platform]
                        )
                      }
                      className={`px-3 py-1.5 text-sm border rounded-lg capitalize transition-colors ${
                        selectedPlatforms.includes(platform)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-0 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={
                setupWorkspaceMutation.isPending ||
                createCampaignMutation.isPending
              }
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {setupWorkspaceMutation.isPending || createCampaignMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentStep === 3 ? 'Creating...' : 'Setting up...'}
                </>
              ) : (
                <>
                  {currentStep === 3 ? 'Create & Generate' : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
