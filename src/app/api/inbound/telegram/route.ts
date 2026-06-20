import { NextRequest, NextResponse } from "next/server";

import {
  type TelegramUpdate,
  buildContactMetadata,
  extractInboundMessage,
  getSecretFromHeader,
  parseTelegramUpdate,
  type RawMessageWithVoice,
} from "@/lib/channels/telegram";
import { resolveTelegramFile } from "@/lib/channels/telegram-file";
import { runInlineDetectionDemo } from "@/lib/channels/inline-detect";
import { readDemoState, writeDemoState } from "@/lib/demo-state";
import { safeSupabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Telegram Bot API webhook endpoint.
 *
 * URL: POST /api/inbound/telegram
 *
 * Behavior:
 *   1. If process.env.TELEGRAM_WEBHOOK_SECRET is set, reject requests whose
 *      X-Telegram-Bot-Api-Secret-Token header doesn't match.
 *   2. Parse the update, normalize to Loop's RawMessage shape.
 *   3. Upsert a Contact for the sender (Telegram chat_id, name, username).
 *   4. Insert into raw_messages (or the demo state store when Supabase is
 *      not configured).
 *   5. Trigger an Inngest `message.received` event for downstream processing
 *      (commitment detection, voice transcription, etc.).
 *
 * Voice messages are NOT transcribed here — Feature 2 (Whisper) handles that
 * in the Inngest consumer so this endpoint stays fast (Telegram retries on
 * >5s response).
 */
export async function POST(req: NextRequest) {
  // ── 1. Secret-token verification ──────────────────────────────────────
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (configuredSecret) {
    const provided = getSecretFromHeader(req.headers);
    if (!provided || !constantTimeEqual(provided, configuredSecret)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  // ── 2. Parse + normalize ──────────────────────────────────────────────
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = parseTelegramUpdate(update);
  if (parsed.kind === "skip") {
    return NextResponse.json({ ok: true, skipped: parsed.reason });
  }

  const message = extractInboundMessage(parsed, { upsertedContactId: null });

  // Opportunistically resolve voice file_id → download URL when the bot
  // token is configured. If the token is missing (e.g. local dev), we
  // leave audio_url null and let the /api/transcribe endpoint resolve it
  // later (or surface "needs-telegram-resolve" to the operator).
  if (message.is_voice_note && message.audio_url === null) {
    const fileId = (message.metadata as { voice_file_id?: string })?.voice_file_id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (fileId && botToken) {
      try {
        const resolved = await resolveTelegramFile(botToken, fileId);
        message.audio_url = resolved.downloadUrl;
        message.media_url = resolved.downloadUrl;
        message.metadata = {
          ...message.metadata,
          telegram_file_path: resolved.filePath,
          telegram_file_size: resolved.fileSize,
        };
      } catch (e) {
        // Non-fatal: the message is stored; transcription can be retried.
        console.warn("[telegram-webhook] getFile failed:", e);
      }
    }
  }

  // ── 3 + 4. Persist (Supabase when available, demo-state fallback) ────
  const supabase = safeSupabase();
  if (!supabase) {
    const deduped = persistToDemoStateIfNew(message, "skip" in parsed ? null : (parsed as any).fromName);
    if (deduped) {
      return NextResponse.json({ ok: true, demoMode: true, messageId: message.id });
    }
    return NextResponse.json({ ok: true, demoMode: true, skipped: "duplicate", messageId: message.id });
  }

  // Upsert contact — Telegram chat_id goes in `phone` (no separate field for
  // platform-native IDs; the `metadata.channel` discriminates them).
  const phone = (parsed as any).chatId ?? null;
  const name = (parsed as any).fromName ?? null;
  const metadata = buildContactMetadata(parsed as any);

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .upsert({ phone, name, metadata }, { onConflict: "phone" })
    .select()
    .single();

  if (contactErr) {
    return NextResponse.json(
      { ok: false, error: `contact upsert failed: ${contactErr.message}` },
      { status: 500 },
    );
  }

  message.contact_id = contact?.id ?? null;

  // Dedup check — re-deliveries from Telegram shouldn't double-insert.
  const { data: existing } = await supabase
    .from("raw_messages")
    .select("id")
    .eq("external_id", message.external_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: "duplicate", messageId: existing.id });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("raw_messages")
    .insert({
      contact_id: message.contact_id,
      external_id: message.external_id,
      channel: message.channel,
      direction: message.direction,
      content: message.content,
      media_url: message.media_url,
      audio_url: message.audio_url,
      status: message.status,
      raw_payload: { ...message.raw_payload, metadata: message.metadata },
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: `message insert failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // ── 5. Trigger downstream processing ──────────────────────────────────
  // Best-effort: if Inngest isn't configured, the message is already stored
  // and a follow-up Inngest sync job will pick it up.
  try {
    const { inngest } = await import("@/lib/inngest");
    await inngest.send({
      name: "message.received",
      data: {
        messageId: inserted.id,
        contactId: message.contact_id,
        channel: message.channel,
        isVoice: message.is_voice_note,
      },
    });
  } catch {
    // Non-fatal: the Inngest client isn't reachable in tests / demo mode.
  }

  return NextResponse.json({
    ok: true,
    messageId: inserted.id,
    contactId: message.contact_id,
    isVoice: message.is_voice_note,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "telegram-webhook",
    ready: true,
    secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true if the message was inserted, false if it was a duplicate.
 */
function persistToDemoStateIfNew(message: RawMessageWithVoice, contactName: string | null): boolean {
  const state = readDemoState();
  // Dedup — Telegram re-deliveries shouldn't double-insert.
  if (state.messages.some((m) => m.external_id === message.external_id)) {
    return false;
  }
  const stored = {
    id: message.id,
    contact_id: message.contact_id ?? null,
    external_id: message.external_id,
    channel: message.channel,
    direction: message.direction,
    content: message.content ?? null,
    media_url: message.media_url ?? null,
    audio_url: message.audio_url ?? null,
    status: message.status,
    raw_payload: { ...message.raw_payload, metadata: message.metadata },
    created_at: message.created_at,
  };
  state.messages.unshift(stored as (typeof state.messages)[number]);
  writeDemoState(state);

  // Real-time inline detection via shared helper.
  runInlineDetectionDemo(stored.id, contactName);
  return true;
}