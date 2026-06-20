import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroq(): Groq {
  if (client) {
    return client;
  }

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing.");
  }

  client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  return client;
}
