/**
 * Tests for /api/inbound/telegram webhook.
 *
 * We can't easily run Next.js route handlers directly under Vitest without
 * a complex setup, so these tests cover the most error-prone behaviors in
 * isolation:
 *
 *   1. Secret-token verification (without / without configured secret)
 *   2. Skipped vs. processed update decisions
 *   3. End-to-end normalization for text + voice updates
 *
 * The full integration with Supabase is exercised by the live route
 * (`tests/api-supabase-integration.test.ts`) when SUPABASE_URL is set.
 */

import { describe, expect, it } from "vitest";

import {
  type TelegramUpdate,
  extractInboundMessage,
  getSecretFromHeader,
  parseTelegramUpdate,
} from "../src/lib/channels/telegram";

/**
 * Replicates the route's secret verification logic so we can unit-test
 * the decision without spinning up Next.js. Keep this in sync with the
 * route handler's check.
 */
function isAuthorized(headers: Headers, configuredSecret: string | undefined): boolean {
  if (!configuredSecret) return true; // dev mode: accept all
  const provided = getSecretFromHeader(headers);
  if (!provided) return false;
  // Constant-time compare to avoid timing attacks
  if (provided.length !== configuredSecret.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ configuredSecret.charCodeAt(i);
  }
  return diff === 0;
}

describe("telegram webhook — secret verification", () => {
  it("accepts requests when no secret is configured (dev mode)", () => {
    expect(isAuthorized(new Headers(), undefined)).toBe(true);
  });

  it("accepts requests with matching secret", () => {
    const headers = new Headers({ "X-Telegram-Bot-Api-Secret-Token": "secret-abc" });
    expect(isAuthorized(headers, "secret-abc")).toBe(true);
  });

  it("rejects requests with wrong secret", () => {
    const headers = new Headers({ "X-Telegram-Bot-Api-Secret-Token": "wrong" });
    expect(isAuthorized(headers, "secret-abc")).toBe(false);
  });

  it("rejects requests missing the header when secret configured", () => {
    expect(isAuthorized(new Headers(), "secret-abc")).toBe(false);
  });
});

describe("telegram webhook — skip vs process decisions", () => {
  it("skips callback_query updates", () => {
    const update: TelegramUpdate = {
      update_id: 1,
      callback_query: { id: "cb" },
    };
    expect(parseTelegramUpdate(update).kind).toBe("skip");
  });

  it("skips messages from bots", () => {
    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 1,
        date: 1718800000,
        chat: { id: 1, type: "private", first_name: "Bot" },
        from: { id: 1, is_bot: true, first_name: "Bot" },
        text: "echo",
      },
    };
    expect(parseTelegramUpdate(update).kind).toBe("skip");
  });

  it("processes text messages from human users", () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 4,
        date: 1718800000,
        chat: { id: 7, type: "private", first_name: "User" },
        from: { id: 7, is_bot: false, first_name: "User" },
        text: "hi",
      },
    };
    expect(parseTelegramUpdate(update).kind).toBe("text");
  });

  it("processes voice messages from human users", () => {
    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        message_id: 5,
        date: 1718800000,
        chat: { id: 7, type: "private", first_name: "User" },
        from: { id: 7, is_bot: false, first_name: "User" },
        voice: { file_id: "x", duration: 1 },
      },
    };
    expect(parseTelegramUpdate(update).kind).toBe("voice");
  });
});

describe("telegram webhook — normalization for storage", () => {
  it("builds a complete RawMessageWithVoice for text updates", () => {
    const update: TelegramUpdate = {
      update_id: 5,
      message: {
        message_id: 100,
        date: 1718800000,
        chat: { id: 50, type: "private", first_name: "A" },
        from: { id: 50, is_bot: false, first_name: "A" },
        text: "Need 20 chairs by Friday",
      },
    };
    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("text");
    if (parsed.kind !== "text") return;

    const raw = extractInboundMessage(parsed, { upsertedContactId: "c-50" });
    expect(raw.external_id).toBe("telegram:50:100");
    expect(raw.contact_id).toBe("c-50");
    expect(raw.channel).toBe("telegram");
    expect(raw.direction).toBe("inbound");
    expect(raw.content).toBe("Need 20 chairs by Friday");
    expect(raw.status).toBe("pending");
    expect(raw.is_voice_note).toBe(false);
    expect(raw.transcription).toBeNull();
  });

  it("builds a complete RawMessageWithVoice for voice updates", () => {
    const update: TelegramUpdate = {
      update_id: 6,
      message: {
        message_id: 101,
        date: 1718800000,
        chat: { id: 51, type: "private", first_name: "B" },
        from: { id: 51, is_bot: false, first_name: "B" },
        voice: { file_id: "voice-1", duration: 8, mime_type: "audio/ogg" },
        caption: "payment proof",
      },
    };
    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("voice");
    if (parsed.kind !== "voice") return;

    const raw = extractInboundMessage(parsed, { upsertedContactId: "c-51" });
    expect(raw.is_voice_note).toBe(true);
    expect(raw.content).toBe("payment proof");
    expect(raw.audio_url).toBeNull();
    expect(raw.transcription).toBeNull();
    expect(raw.metadata).toMatchObject({
      voice_file_id: "voice-1",
      voice_duration_sec: 8,
      voice_mime_type: "audio/ogg",
    });
  });
});

describe("telegram webhook — dedupe via external_id", () => {
  it("the same update produces the same external_id, regardless of which field carries the message", () => {
    const baseMsg = {
      message_id: 99,
      date: 1718800000,
      chat: { id: 7, type: "private" as const, first_name: "X" },
      from: { id: 7, is_bot: false, first_name: "X" },
      text: "hi",
    };
    const a = parseTelegramUpdate({ update_id: 1, message: baseMsg });
    const b = parseTelegramUpdate({ update_id: 2, edited_message: baseMsg });
    expect(a.kind).toBe("text");
    expect(b.kind).toBe("text");
    if (a.kind !== "text" || b.kind !== "text") return;
    expect(a.externalId).toBe(b.externalId);
  });
});