"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function createCampaign(body: Record<string, unknown>) {
  const res = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

async function generateCampaign(id: string) {
  const res = await fetch(`/api/campaigns/${id}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
}

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
];

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: "📷" },
  { value: "facebook", label: "Facebook", icon: "👥" },
  { value: "linkedin", label: "LinkedIn", icon: "💼" },
];

const AUDIENCE_TAGS = [
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45-54", label: "45-54" },
  { value: "55+", label: "55+" },
  { value: "tech", label: "Tech" },
  { value: "business", label: "Business" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "fitness", label: "Fitness" },
  { value: "food", label: "Food" },
  { value: "travel", label: "Travel" },
  { value: "fashion", label: "Fashion" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("professional");
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [useBrandConfig, setUseBrandConfig] = useState(true);
  const [goal, setGoal] = useState("engagement");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => createCampaign(body),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => generateCampaign(id),
  });

  const isCreating = createMutation.isPending || generateMutation.isPending;

  const toggleAudienceTag = (tag: string) => {
    setAudienceTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!brief.trim()) newErrors.brief = "Brief is required";
    if (brief.length < 20) newErrors.brief = "Brief should be at least 20 characters";
    if (selectedPlatforms.length === 0) newErrors.platforms = "Select at least one platform";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const campaign = await createMutation.mutateAsync({
        title,
        brief,
        tone,
        audience: {
          tags: audienceTags,
          goal,
        },
        platforms: selectedPlatforms,
        useBrandConfig,
      });

      toast.success("Campaign created! Generating content...");

      await generateMutation.mutateAsync(campaign.id);

      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      router.push(`/dashboard/campaigns/${campaign.id}/generate`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create campaign");
      }
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/campaigns"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <p className="text-gray-500">Fill in the details to generate AI-powered content</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="bg-white rounded-xl border p-6 space-y-6">
          <h2 className="text-lg font-semibold">Campaign Details</h2>

          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Campaign Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Summer Product Launch"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.title ? "border-red-300" : ""
              }`}
            />
            {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="brief" className="block text-sm font-medium mb-1">
              Campaign Brief <span className="text-red-500">*</span>
            </label>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe your campaign topic, key messages, and any specific requirements..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
                errors.brief ? "border-red-300" : ""
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.brief ? (
                <p className="text-sm text-red-500">{errors.brief}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">{brief.length} characters</span>
            </div>
          </div>

          <div>
            <label htmlFor="goal" className="block text-sm font-medium mb-1">
              Campaign Goal
            </label>
            <select
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="engagement">Engagement</option>
              <option value="awareness">Brand Awareness</option>
              <option value="traffic">Website Traffic</option>
              <option value="leads">Lead Generation</option>
              <option value="sales">Sales</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-6">
          <h2 className="text-lg font-semibold">Content Style</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Tone of Voice</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    tone === t.value
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Audience</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleAudienceTag(tag.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    audienceTags.includes(tag.value)
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tag.label}
                  {audienceTags.includes(tag.value) && <X className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-6">
          <h2 className="text-lg font-semibold">Platforms</h2>

          <div>
            <label className="block text-sm font-medium mb-2">
              Select Platforms <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.value);
                return (
                  <button
                    key={platform.value}
                    type="button"
                    onClick={() => togglePlatform(platform.value)}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl">{platform.icon}</span>
                    <span className="font-medium">{platform.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.platforms && <p className="text-sm text-red-500 mt-2">{errors.platforms}</p>}
          </div>

          <div className="flex items-center gap-3">
            <input
              id="brand-config"
              type="checkbox"
              checked={useBrandConfig}
              onChange={(e) => setUseBrandConfig(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="brand-config" className="text-sm font-medium">
              Use workspace brand configuration
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard/campaigns"
            className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isCreating}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isCreating ? "Creating..." : "Create & Generate"}
          </button>
        </div>
      </form>
    </div>
  );
}
