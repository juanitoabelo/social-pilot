import { Anthropic } from "@anthropic-ai/sdk";
import { PLATFORM_DIMENSIONS, PLATFORM_LIMITS } from "../../../../packages/shared/src";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateCopy(params: {
  brief: string;
  platform: string;
  audience: Record<string, unknown>;
  brandConfig: Record<string, unknown>;
}): Promise<{
  caption: string;
  hashtags: string[];
  cta: string;
  alt_text: string;
  image_prompt_hint: string;
}> {
  const brandName = (params.brandConfig.brand_name as string) || "your brand";
  const tone = (params.brandConfig.tone as string) || "professional";
  const doRules = Array.isArray(params.brandConfig.do) ? (params.brandConfig.do as string[]) : [];
  const dontRules = Array.isArray(params.brandConfig.dont) ? (params.brandConfig.dont as string[]) : [];
  const hashtagStyle = (params.brandConfig.hashtag_style as string) || "lowercase";
  const emojiPolicy = (params.brandConfig.emoji_policy as string) || "optional";
  const charLimit = (PLATFORM_LIMITS as Record<string, { caption: number }>)[params.platform]?.caption ?? 2200;

  const systemPrompt = `You are an expert social media copywriter for ${brandName}.

Your tone is: ${tone}.

Brand rules you MUST follow:
${doRules.length > 0 ? "DO: " + doRules.join(", ") : ""}
${dontRules.length > 0 ? "DO NOT: " + dontRules.join(", ") : ""}
Hashtag style: ${hashtagStyle === "lowercase" ? "all lowercase" : hashtagStyle === "camelcase" ? "CamelCase" : "no hashtags"}
Emoji policy: ${emojiPolicy === "required" ? "Use 1-3 emojis in every post" : emojiPolicy === "none" ? "Do NOT use any emojis" : "Use emojis sparingly, max 1-2"}

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanation, no preamble.
The response must parse as JSON with these exact keys: caption, hashtags, cta, alt_text, image_prompt_hint`;

  const userPrompt = `Create a ${params.platform} post for this campaign:

Campaign brief: ${params.brief}
Target audience: ${JSON.stringify(params.audience)}
Character limit: ${charLimit}

Required JSON structure:
{
  "caption": "Full post caption text (${charLimit} chars max, optimized for ${params.platform})",
  "hashtags": ["5-10 relevant hashtags in ${hashtagStyle} format"],
  "cta": "Short call-to-action (under 30 chars)",
  "alt_text": "Descriptive alt text for accessibility (under 125 chars)",
  "image_prompt_hint": "1-2 sentence description of the ideal image to accompany this post"
}

Make the caption:
- Attention-grabbing in the first line
- Platform-appropriate length and style
- Natural and engaging (not salesy)
- End with a clear CTA`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonStr = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      caption: parsed.caption ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      cta: parsed.cta ?? "",
      alt_text: parsed.alt_text ?? "",
      image_prompt_hint: parsed.image_prompt_hint ?? "",
    };
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${text.slice(0, 200)}`);
  }
}

export async function generateImagePrompt(params: {
  caption: string;
  imageHint: string;
  brandConfig: Record<string, unknown>;
  platform: string;
}): Promise<string> {
  const visualStyle = (params.brandConfig.visual_style as string) || "clean, modern, professional";
  const dims = (PLATFORM_DIMENSIONS as Record<string, { feed?: { aspectRatio: string } }>)[params.platform]?.feed?.aspectRatio ?? "1:1";

  const prompt = `Given this social media caption, write a DALL·E 3 image generation prompt.

Caption: "${params.caption}"
Image hint: "${params.imageHint}"
Brand visual style: ${visualStyle}
Platform aspect ratio: ${dims}

Rules:
- Do NOT include any text, words, or letters in the image
- Make it visually compelling and scroll-stopping
- Match the tone and subject of the caption
- Photorealistic style unless brand specifies otherwise
- High quality, well-lit, professional composition
- Specify the aspect ratio contextually

Respond with ONLY the image prompt text. Nothing else.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 512,
    messages: [
      { role: "user", content: prompt },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text.trim() : "";
}
