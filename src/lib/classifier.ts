import { getGroq } from "./groq";

const NOISE_WORDS = new Set([
  "ok",
  "okay",
  "thanks",
  "thank you",
  "thx",
  "done",
  "got it",
  "gotcha",
  "will do",
  "noted",
  "k",
  "kk",
  "cool",
  "great",
  "sure",
  "👍",
  "👌",
  "yes",
  "no",
  "nope",
  "yeah",
  "ok thanks",
  "ok thank you",
  "thank u",
  "ty",
  "received",
  "acknowledged",
]);

const ACTION_WORDS = [
  "send",
  "quote",
  "check",
  "call",
  "pay",
  "book",
  "confirm",
  "deliver",
  "follow up",
  "prepare",
  "order",
  "invoice",
  "schedule",
];

export function isNoise(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  return normalized.length === 0 || NOISE_WORDS.has(normalized);
}

export function hasActionSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return ACTION_WORDS.some((word) => normalized.includes(word));
}

export async function classifyMessage(text: string): Promise<"noise" | "task" | "unclear"> {
  if (isNoise(text)) return "noise";
  if (hasActionSignal(text)) return "task";

  const prompt = `Classify this business message as exactly one word: noise, task, or unclear.\n\nMessage: "${text}"`;
  const response = await getGroq().chat.completions.create({
    model: process.env.GROQ_CLASSIFIER_MODEL || "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 10,
  });

  const result = response.choices[0]?.message?.content?.trim().toLowerCase() || "unclear";
  if (result.includes("noise")) return "noise";
  if (result.includes("task")) return "task";
  return "unclear";
}
