import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenRouter(): OpenAI {
  if (client) {
    return client;
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.VERCEL_URL || "http://localhost:3000",
      "X-Title": "Loop Agent",
    },
  });

  return client;
}
