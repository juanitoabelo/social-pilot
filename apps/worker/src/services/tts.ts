import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const VOICE_BY_TONE: Record<string, TTSVoice> = {
  professional: "onyx",
  casual: "alloy",
  humorous: "fable",
  inspirational: "nova",
  educational: "echo",
};

export async function generateTTS({
  text,
  tone = "professional",
  speed = 1.0,
}: {
  text: string;
  tone?: string;
  speed?: number;
}): Promise<Buffer> {
  const voice = VOICE_BY_TONE[tone] || "alloy";

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    speed,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

export async function generateTTSWithSSML({
  text,
  tone = "professional",
  speed = 1.0,
  pauseBefore = 0,
  pauseAfter = 0,
}: {
  text: string;
  tone?: string;
  speed?: number;
  pauseBefore?: number;
  pauseAfter?: number;
}): Promise<Buffer> {
  const voice = VOICE_BY_TONE[tone] || "alloy";

  let input = "";
  if (pauseBefore > 0) {
    input += `<break time="${pauseBefore}ms"/>`;
  }
  input += text;
  if (pauseAfter > 0) {
    input += `<break time="${pauseAfter}ms"/>`;
  }

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input,
    speed,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}
