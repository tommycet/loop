/**
 * Telegram Bot API webhook normalizer.
 *
 * Converts a raw Telegram Update payload into Loop's unified RawMessage shape
 * (or a "skip" decision for non-message updates, bot-originated messages,
 * callback queries, inline queries, etc.).
 *
 * Reference for the Update shape:
 *   https://core.telegram.org/bots/api#update
 *
 * Security: Telegram webhooks can be authenticated with a shared secret sent
 * in the X-Telegram-Bot-Api-Secret-Token header (configured when registering
 * the webhook via the setWebhook API call). The route handler MUST compare
 * this value to the configured server-side secret before processing.
 */

import type { Channel, MessageStatus, RawMessage } from "../../types";

// ─── Telegram Update shapes (only the fields we read) ─────────────────────

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
  username?: string;
}

export interface TelegramVoice {
  file_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessageCore {
  message_id: number;
  date: number; // unix seconds
  edit_date?: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  photo?: unknown[];
  document?: unknown;
  is_bot?: boolean;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessageCore;
  edited_message?: TelegramMessageCore;
  callback_query?: unknown;
  inline_query?: unknown;
}

// ─── Normalized intermediate result ──────────────────────────────────────

export type ParsedTelegram =
  | { kind: "skip"; reason: string }
  | {
      kind: "text";
      externalId: string;
      fromId: string;
      fromName: string | null;
      fromUsername: string | null;
      chatId: string;
      chatType: TelegramChat["type"];
      content: string;
      receivedAt: string;
      isVoice: false;
      mediaUrl: null;
    }
  | {
      kind: "voice";
      externalId: string;
      fromId: string;
      fromName: string | null;
      fromUsername: string | null;
      chatId: string;
      chatType: TelegramChat["type"];
      content: string | null;
      receivedAt: string;
      isVoice: true;
      mediaUrl: null;
      voiceFileId: string;
      voiceDurationSec: number;
      voiceMimeType: string | null;
    };

// ─── Pure helpers (exported for tests) ────────────────────────────────────

/**
 * Build a stable externalId. Telegram's message_id is unique per chat,
 * so we prefix the chat_id to disambiguate across chats.
 */
function externalIdFor(chatId: number, messageId: number): string {
  return `telegram:${chatId}:${messageId}`;
}

/**
 * Unix seconds → ISO 8601 string. Telegram delivers `date` as seconds.
 */
function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

/**
 * Compose a human-readable name from Telegram's first/last fields.
 */
function composeName(user: TelegramUser | undefined): string | null {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Parse a Telegram Update into a ParsedTelegram. Pure function — no I/O,
 * no clock side effects beyond `new Date()` for the timestamp formatting.
 */
export function parseTelegramUpdate(update: TelegramUpdate): ParsedTelegram {
  // Telegram may send edits as either `message` (forwarded) or
  // `edited_message` (the actual edit). Both have the same shape.
  const raw = update.message ?? update.edited_message;
  if (!raw) {
    return { kind: "skip", reason: "no message or edited_message in update" };
  }

  // Ignore echoes from our own bot (defense in depth — Telegram doesn't
  // send updates for messages we sent, but a misconfigured webhook could).
  if (raw.from?.is_bot === true) {
    return { kind: "skip", reason: "message from bot" };
  }

  const fromId = String(raw.from?.id ?? raw.chat.id);
  const fromName = composeName(raw.from);
  const fromUsername = raw.from?.username ?? null;
  const chatId = String(raw.chat.id);
  const chatType = raw.chat.type;
  const receivedAt = unixToIso(raw.date);
  const externalId = externalIdFor(raw.chat.id, raw.message_id);

  if (raw.voice) {
    return {
      kind: "voice",
      externalId,
      fromId,
      fromName,
      fromUsername,
      chatId,
      chatType,
      content: raw.caption ?? null,
      receivedAt,
      isVoice: true,
      mediaUrl: null,
      voiceFileId: raw.voice.file_id,
      voiceDurationSec: raw.voice.duration,
      voiceMimeType: raw.voice.mime_type ?? null,
    };
  }

  if (raw.text || raw.caption) {
    return {
      kind: "text",
      externalId,
      fromId,
      fromName,
      fromUsername,
      chatId,
      chatType,
      content: raw.text ?? raw.caption ?? "",
      receivedAt,
      isVoice: false,
      mediaUrl: null,
    };
  }

  return { kind: "skip", reason: "no text, caption, or voice in message" };
}

/**
 * Extract a Telegram user's display name into Loop's Contact.metadata shape.
 */
export function buildContactMetadata(parsed: ParsedTelegram): Record<string, unknown> {
  if (parsed.kind === "skip") return {};
  return {
    channel: "telegram",
    telegram_chat_id: parsed.chatId,
    telegram_chat_type: parsed.chatType,
    telegram_from_id: parsed.fromId,
    telegram_username: parsed.fromUsername,
  };
}

/**
 * Map a ParsedTelegram into the unified RawMessage shape Loop uses everywhere.
 *
 * The `upsertedContactId` is the result of an earlier contacts upsert by
 * the route handler; it may be null if the contact couldn't be upserted
 * (we still store the message, the contact join can be repaired later).
 */
export function extractInboundMessage(
  parsed: ParsedTelegram,
  options: { upsertedContactId: string | null },
): RawMessageWithVoice {
  if (parsed.kind === "skip") {
    throw new Error("cannot extract a skipped update");
  }

  const baseChannel: Channel = "telegram";
  const baseStatus: MessageStatus = "pending";

  const metadata: Record<string, unknown> = {
    from_id: parsed.fromId,
    from_name: parsed.fromName,
    from_username: parsed.fromUsername,
    chat_id: parsed.chatId,
    chat_type: parsed.chatType,
    received_at_iso: parsed.receivedAt,
  };

  const raw: RawMessageWithVoice = {
    id: parsed.externalId,
    contact_id: options.upsertedContactId,
    external_id: parsed.externalId,
    channel: baseChannel,
    direction: "inbound",
    content: parsed.content,
    media_url: parsed.kind === "voice" ? parsed.mediaUrl : null,
    audio_url: parsed.kind === "voice" ? parsed.mediaUrl : null,
    status: baseStatus,
    raw_payload: { telegram: parsed },
    created_at: parsed.receivedAt,
    // Loop's RawMessage doesn't (yet) carry is_voice_note or transcription
    // directly — we attach them to raw_payload.metadata and to a top-level
    // spread below. The DB column for voice detection is added separately.
    is_voice_note: parsed.isVoice,
    transcription: null,
    metadata,
  };

  if (parsed.kind === "voice") {
    raw.metadata = {
      ...raw.metadata,
      voice_file_id: parsed.voiceFileId,
      voice_duration_sec: parsed.voiceDurationSec,
      voice_mime_type: parsed.voiceMimeType,
    };
  }

  return raw;
}

/**
 * Read the X-Telegram-Bot-Api-Secret-Token header. Returns null if missing.
 * The route handler should compare this to process.env.TELEGRAM_WEBHOOK_SECRET.
 */
export function getSecretFromHeader(headers: Headers): string | null {
  return headers.get("X-Telegram-Bot-Api-Secret-Token");
}

// ─── Type guards ──────────────────────────────────────────────────────────

export function isTextMessage(msg: { text?: string; caption?: string }): boolean {
  return Boolean(msg.text || msg.caption);
}

export function isVoiceMessage(msg: { voice?: { file_id: string } }): boolean {
  return Boolean(msg.voice);
}

// ─── Augmented RawMessage ─────────────────────────────────────────────────

/**
 * RawMessage + the two extra fields we need to track voice notes
 * (the existing type doesn't have them yet). The route handler can
 * strip these when persisting to the DB until migrations add columns.
 */
export type RawMessageWithVoice = RawMessage & {
  is_voice_note: boolean;
  transcription: string | null;
  metadata: Record<string, unknown>;
};