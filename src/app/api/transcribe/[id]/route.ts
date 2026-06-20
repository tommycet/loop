import { NextRequest, NextResponse } from "next/server";

import {
  type TranscribableMessage,
  transcribeAndUpdate,
} from "@/lib/channels/transcribe-pipeline";
import { readDemoState, writeDemoState } from "@/lib/demo-state";
import { getGroq } from "@/lib/groq";
import { safeSupabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * POST /api/transcribe/[id]
 *
 * Manually trigger Groq Whisper transcription on a stored voice message.
 *
 * Behavior:
 *   - Demo mode: reads the message from .demo-state/loop-demo-state.json,
 *     calls Whisper, writes the result back.
 *   - Supabase mode: reads from `raw_messages` table, calls Whisper, updates
 *     the `transcription` column on success.
 *
 * The Inngest `handle-batch` consumer does this automatically for new
 * messages. This endpoint exists for:
 *   - demos where the bot token isn't configured (so Whisper wasn't
 *     pre-fetched)
 *   - re-running transcription on a message that Whisper rejected
 *   - operator-initiated retries
 *
 * 404 if the message doesn't exist.
 * 422 if the message isn't a voice note (no audio_url + no voice_file_id).
 * 502 if the upstream Groq call fails.
 * 500 if anything else goes wrong.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = safeSupabase();

  if (!supabase) {
    return handleDemoMode(params.id);
  }

  return handleSupabaseMode(supabase, params.id);
}

// ─── Demo state path ─────────────────────────────────────────────────────

function handleDemoMode(id: string): Promise<NextResponse> {
  const state = readDemoState();
  const message = state.messages.find((m) => m.id === id);
  if (!message) {
    return Promise.resolve(NextResponse.json({ error: "message not found" }, { status: 404 }));
  }

  const transcribable: TranscribableMessage = {
    id: message.id,
    channel: message.channel,
    audio_url: message.audio_url ?? null,
    transcription: null, // demo state doesn't track this yet
    metadata: ((message.raw_payload as { metadata?: Record<string, unknown> })?.metadata) ?? {},
  };

  return runTranscription(transcribable, (msgId, transcription) => {
    const next = readDemoState();
    const target = next.messages.find((m) => m.id === msgId);
    if (target) {
      target.content = transcription;
      target.raw_payload = {
        ...((target.raw_payload as Record<string, unknown>) ?? {}),
        transcription,
        transcribed_at: new Date().toISOString(),
      };
      writeDemoState(next);
    }
  });
}

// ─── Supabase path ───────────────────────────────────────────────────────

function handleSupabaseMode(
  supabase: ReturnType<typeof safeSupabase> & object,
  id: string,
): Promise<NextResponse> {
  return (async (): Promise<NextResponse> => {
    const { data: row, error } = await supabase
      .from("raw_messages")
      .select("id, channel, audio_url, transcription, raw_payload")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "message not found" }, { status: 404 });
    }

    const transcribable: TranscribableMessage = {
      id: row.id,
      channel: row.channel,
      audio_url: row.audio_url ?? null,
      transcription: row.transcription ?? null,
      metadata: ((row.raw_payload as { metadata?: Record<string, unknown> })?.metadata) ?? {},
    };

    return runTranscription(transcribable, async (msgId, transcription) => {
      const { error: updErr } = await supabase
        .from("raw_messages")
        .update({
          transcription,
          content: transcription,
          transcribed_at: new Date().toISOString(),
        })
        .eq("id", msgId);
      if (updErr) throw new Error(`update failed: ${updErr.message}`);
    });
  })();
}

// ─── Shared core ─────────────────────────────────────────────────────────

function runTranscription(
  message: TranscribableMessage,
  onUpdate: (id: string, transcription: string) => void | Promise<void>,
): Promise<NextResponse> {
  return (async () => {
    try {
      const result = await transcribeAndUpdate(message, {
        transcribeFn: callGroqWhisper,
        onUpdate,
      });
      return NextResponse.json({
        ok: true,
        messageId: result.id,
        transcription: result.transcription,
        cached: result.cached,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes("Cannot transcribe") ? 422 : 502;
      return NextResponse.json({ error: msg }, { status });
    }
  })();
}

/**
 * The actual Groq Whisper call. Uses whisper-large-v3-turbo (228x real-time,
 * 12% WER, $0.04/hr) — already in the project's Groq SDK client.
 */
async function callGroqWhisper({
  bytes,
  mimeType,
  filename,
}: {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }
  // The Groq SDK accepts a File-like object. Node 18+ has Blob + File globals.
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  const groq = getGroq();
  const model = process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo";
  const out = await groq.audio.transcriptions.create({
    file,
    model,
    response_format: "text",
  });
  return typeof out === "string" ? out : (out as { text: string }).text;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Read-only check: returns the transcription status without running it.
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const m = state.messages.find((x) => x.id === params.id);
    if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
    const transcription =
      ((m.raw_payload as { transcription?: string })?.transcription) ?? null;
    return NextResponse.json({
      id: m.id,
      channel: m.channel,
      transcribed: Boolean(transcription),
      transcription,
    });
  }
  const { data } = await supabase
    .from("raw_messages")
    .select("id, channel, audio_url, transcription")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: data.id,
    channel: data.channel,
    transcribed: Boolean(data.transcription),
    transcription: data.transcription ?? null,
  });
}