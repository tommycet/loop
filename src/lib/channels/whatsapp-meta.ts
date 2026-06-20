/**
 * Meta WhatsApp Cloud API webhook normalizer.
 *
 * The existing /api/webhooks/whatsapp uses the Wappfly wrapper, which has
 * its own payload format. Direct Meta Cloud API webhooks deliver a
 * different structure. This normalizer handles that case so operators
 * can connect their own Meta WhatsApp Business App without paying for a
 * BSP.
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *
 * Differences from Wappfly:
 *   - Top-level object is "whatsapp_business_account" (not "event")
 *   - Messages are wrapped under entry[].changes[].value.messages[]
 *   - Contacts are in a separate parallel array (contacts[])
 *   - Message IDs are WAMIDs ("wamid.XXX...")
 *   - Voice notes arrive with `type: "audio"` and `audio.voice: true`
 *   - Audio downloads require a separate GET /v18.0/{media-id} call
 */

import type { Channel, MessageStatus, RawMessage } from "../../types";

// ─── Meta payload shapes (only the fields we read) ────────────────────────

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text";
  text: { body: string };
}

export interface MetaAudioMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "audio";
  audio: {
    id: string;
    mime_type: string;
    sha256?: string;
    voice?: boolean;
  };
}

export type MetaMessage = MetaTextMessage | MetaAudioMessage | { from: string; id: string; timestamp: string; type: string };

export interface MetaWebhookChange {
  value: {
    messaging_product: "whatsapp";
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: MetaContact[];
    messages?: MetaMessage[];
    statuses?: unknown[];
  };
  field: "messages";
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWhatsAppWebhook {
  object: "whatsapp_business_account";
  entry: MetaWebhookEntry[];
}

// ─── Normalized intermediate result ──────────────────────────────────────

export type ParsedMeta =
  | { kind: "skip"; reason: string }
  | {
      kind: "text";
      externalId: string;
      fromPhone: string;
      fromName: string | null;
      content: string;
      receivedAt: string;
      phoneNumberId: string;
    }
  | {
      kind: "audio";
      externalId: string;
      fromPhone: string;
      fromName: string | null;
      audioMediaId: string;
      audioMimeType: string;
      receivedAt: string;
      phoneNumberId: string;
      isVoice: boolean;
    };

// ─── Public API ───────────────────────────────────────────────────────────

export function parseMetaWebhook(webhook: MetaWhatsAppWebhook): ParsedMeta {
  if (webhook.object !== "whatsapp_business_account") {
    return { kind: "skip", reason: "not a whatsapp_business_account webhook" };
  }

  // Flatten all messages across all entries / changes — Meta may batch.
  for (const entry of webhook.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const messages = change.value.messages;
      if (!messages || messages.length === 0) continue;
      // Process the first message. (Real systems might process all, but
      // each has its own webhook delivery; we keep it simple.)
      const message = messages[0];
      const contact = change.value.contacts?.[0];
      const phoneNumberId = change.value.metadata.phone_number_id;
      const fromPhone = message.from;
      const fromName = contact?.profile?.name ?? null;

      if (message.type === "text" && "text" in message) {
        return {
          kind: "text",
          externalId: message.id,
          fromPhone,
          fromName,
          content: message.text.body,
          receivedAt: unixToIso(Number(message.timestamp)),
          phoneNumberId,
        };
      }

      if (message.type === "audio" && "audio" in message) {
        return {
          kind: "audio",
          externalId: message.id,
          fromPhone,
          fromName,
          audioMediaId: message.audio.id,
          audioMimeType: message.audio.mime_type,
          receivedAt: unixToIso(Number(message.timestamp)),
          phoneNumberId,
          isVoice: Boolean(message.audio.voice),
        };
      }

      return { kind: "skip", reason: `unsupported message type: ${message.type}` };
    }
  }

  return { kind: "skip", reason: "no messages in webhook payload" };
}

export function buildMetaContactMetadata(parsed: ParsedMeta): Record<string, unknown> {
  if (parsed.kind === "skip") return {};
  return {
    channel: "whatsapp",
    whatsapp_phone_number_id: parsed.phoneNumberId,
    whatsapp_from: parsed.fromPhone,
  };
}

/**
 * Map a ParsedMeta into the unified RawMessage shape. Same as the
 * Telegram equivalent but uses the contact's phone as the dedupe key
 * anchor (Meta identifies contacts by E.164 phone number, not chat id).
 */
export function extractInboundMessage(
  parsed: ParsedMeta,
  options: { upsertedContactId: string | null },
): RawMessageWithMeta {
  if (parsed.kind === "skip") {
    throw new Error("cannot extract a skipped update");
  }

  const baseChannel: Channel = "whatsapp";
  const baseStatus: MessageStatus = "pending";

  const metadata: Record<string, unknown> = {
    from_phone: parsed.fromPhone,
    from_name: parsed.fromName,
    whatsapp_phone_number_id: parsed.phoneNumberId,
    received_at_iso: parsed.receivedAt,
  };

  const raw: RawMessageWithMeta = {
    id: parsed.externalId,
    contact_id: options.upsertedContactId,
    external_id: parsed.externalId,
    channel: baseChannel,
    direction: "inbound",
    content: parsed.kind === "text" ? parsed.content : null,
    media_url: null,
    audio_url: null,
    status: baseStatus,
    raw_payload: { whatsapp_meta: parsed },
    created_at: parsed.receivedAt,
    is_voice_note: parsed.kind === "audio" && parsed.isVoice,
    transcription: null,
    metadata,
  };

  if (parsed.kind === "audio") {
    raw.metadata = {
      ...raw.metadata,
      whatsapp_media_id: parsed.audioMediaId,
      whatsapp_mime_type: parsed.audioMimeType,
    };
  }

  return raw;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

// ─── Augmented RawMessage ─────────────────────────────────────────────────

export type RawMessageWithMeta = RawMessage & {
  is_voice_note: boolean;
  transcription: string | null;
  metadata: Record<string, unknown>;
};