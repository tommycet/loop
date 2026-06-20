/**
 * Voice note transcription pipeline.
 *
 * Given a stored message (with or without an audio_url, with or without a
 * transcription), determines whether transcription is needed and what URL
 * to download from. Used by:
 *   - the Inngest consumer (handle-batch) for Supabase-mode auto-transcription
 *   - the /api/transcribe/[id] route for manual triggering (demos)
 *   - Feature 3 (real-time detection on live messages) for fresh voice notes
 *
 * The actual call to Groq Whisper is injected via `transcribeFn` so the
 * pipeline can be tested without hitting the network.
 */

export interface TranscribableMessage {
  id: string;
  channel: string;
  audio_url: string | null;
  transcription: string | null;
  metadata?: Record<string, unknown>;
}

export type ResolveResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason:
        | "not-a-voice-note"
        | "needs-telegram-resolve"
        | "needs-whatsapp-resolve"
        | "missing-audio"
        | "already-transcribed";
      fileId?: string;
    };

export interface TranscribeInput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export type TranscribeFn = (input: TranscribeInput) => Promise<string>;

export interface TranscribeOptions {
  transcribeFn: TranscribeFn;
  onUpdate: (id: string, transcription: string) => void | Promise<void>;
}

export interface TranscribeResult {
  id: string;
  transcription: string;
  cached: boolean;
}

/**
 * Decide whether transcription is needed and where to fetch audio from.
 */
export function resolveMessageAudio(message: TranscribableMessage): ResolveResult {
  if (message.transcription) {
    return { ok: false, reason: "already-transcribed" };
  }
  if (message.audio_url) {
    return { ok: true, url: message.audio_url };
  }
  // Telegram voice notes arrive with file_id only — caller must resolve.
  const fileId = (message.metadata as { voice_file_id?: string } | undefined)
    ?.voice_file_id;
  if (fileId) {
    return { ok: false, reason: "needs-telegram-resolve", fileId };
  }
  // WhatsApp voice notes arrive as media_url on the wappfly payload but
  // are not yet mirrored to audio_url in our schema. For now we treat
  // this as missing-audio; the wappfly webhook should populate audio_url
  // before this pipeline runs.
  return { ok: false, reason: "not-a-voice-note" };
}

/**
 * Run the transcription pipeline on a single stored message.
 *
 * Idempotent: if the message already has a transcription, returns it
 * and skips the call to `transcribeFn`. Otherwise fetches the audio,
 * passes the bytes to `transcribeFn`, persists the result via
 * `onUpdate`, and returns.
 */
export async function transcribeAndUpdate(
  message: TranscribableMessage,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  if (message.transcription) {
    return { id: message.id, transcription: message.transcription, cached: true };
  }

  const resolved = resolveMessageAudio(message);
  if (!resolved.ok) {
    throw new Error(`Cannot transcribe ${message.id}: ${resolved.reason}`);
  }

  const res = await fetch(resolved.url);
  if (!res.ok) {
    throw new Error(`Audio fetch failed: HTTP ${res.status}`);
  }
  const mimeType =
    res.headers.get("content-type") ??
    ((message.metadata as { voice_mime_type?: string } | undefined)
      ?.voice_mime_type ?? "audio/ogg");
  const bytes = new Uint8Array(await res.arrayBuffer());
  const filename = `${message.id}.ogg`;
  const transcription = await options.transcribeFn({ bytes, mimeType, filename });
  await options.onUpdate(message.id, transcription);
  return { id: message.id, transcription, cached: false };
}