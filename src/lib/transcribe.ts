import { getGroq } from "./groq";

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`);
  }

  const blob = await response.blob();
  const file = new File([blob], "audio.ogg", { type: blob.type || "audio/ogg" });

  const transcription = await getGroq().audio.transcriptions.create({
    file,
    model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3",
    response_format: "text",
  });

  return transcription as unknown as string;
}
