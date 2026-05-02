export type VideoTemplate = {
  id: string;
  name: string;
  description: string;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  duration: number;
  requiredInputs: string[];
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "quote-card",
    name: "Quote Card",
    description: "Text overlay on background image with animated entrance",
    aspectRatio: "4:5",
    duration: 5,
    requiredInputs: ["backgroundImage", "text"],
  },
  {
    id: "hook-reveal",
    name: "Hook & Reveal",
    description: "Hook text appears first, then main content reveals after a pause",
    aspectRatio: "9:16",
    duration: 8,
    requiredInputs: ["backgroundImage", "hookText", "mainText"],
  },
  {
    id: "slide-show",
    name: "Slide Show",
    description: "Multiple images with crossfade transitions",
    aspectRatio: "9:16",
    duration: 15,
    requiredInputs: ["images"],
  },
];

export function getTemplateById(id: string): VideoTemplate | undefined {
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesForPlatform(platform: string): VideoTemplate[] {
  const ratios = PLATFORM_PREFERRED_RATIOS[platform] || ["9:16"];
  return VIDEO_TEMPLATES.filter((t) => ratios.includes(t.aspectRatio));
}

const PLATFORM_PREFERRED_RATIOS: Record<string, string[]> = {
  instagram: ["9:16", "1:1", "4:5"],
  tiktok: ["9:16"],
  facebook: ["16:9", "1:1"],
  twitter: ["16:9"],
  linkedin: ["16:9", "1:1"],
  pinterest: ["4:5", "9:16"],
};
