import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImage(params: {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
}): Promise<{ url: string; b64_json?: string }> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: params.prompt,
    size: params.size ?? "1024x1024",
    quality: "standard",
    response_format: "b64_json",
  });

  const image = response.data?.[0];
  if (!image) {
    throw new Error("DALL·E 3 returned no image data");
  }

  return {
    url: image.url ?? "",
    b64_json: image.b64_json,
  };
}
