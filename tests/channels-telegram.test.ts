/**
 * Telegram webhook payload normalization tests.
 *
 * The Telegram Bot API delivers Updates as JSON. We convert relevant
 * Update.message and Update.edited_message payloads into Loop's unified
 * RawMessage shape so the rest of the pipeline (detection, risk,
 * authority) doesn't need to know which channel it came from.
 */

import { describe, expect, it } from "vitest";

import {
  type TelegramUpdate,
  extractInboundMessage,
  getSecretFromHeader,
  isTextMessage,
  isVoiceMessage,
  parseTelegramUpdate,
} from "../src/lib/channels/telegram";

describe("parseTelegramUpdate", () => {
  it("parses a text message update into a normalized message", () => {
    const update: TelegramUpdate = {
      update_id: 123456789,
      message: {
        message_id: 42,
        date: 1718800000,
        chat: { id: 9001, type: "private", first_name: "Ahmed" },
        from: { id: 9001, is_bot: false, first_name: "Ahmed", username: "ahmedk" },
        text: "I need 20 chairs by Friday and a discount if I pay today",
      },
    };

    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("text");
    if (parsed.kind !== "text") return;

    expect(parsed.externalId).toBe("telegram:9001:42");
    expect(parsed.fromId).toBe("9001");
    expect(parsed.fromName).toBe("Ahmed");
    expect(parsed.fromUsername).toBe("ahmedk");
    expect(parsed.chatId).toBe("9001");
    expect(parsed.chatType).toBe("private");
    expect(parsed.content).toBe(
      "I need 20 chairs by Friday and a discount if I pay today",
    );
    expect(parsed.receivedAt).toBe("2024-06-19T12:26:40.000Z");
    expect(parsed.isVoice).toBe(false);
    expect(parsed.mediaUrl).toBeNull();
  });

  it("parses a voice message and flags isVoice with file_id", () => {
    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 7,
        date: 1718800100,
        chat: { id: 9002, type: "private", first_name: "Fatima" },
        from: { id: 9002, is_bot: false, first_name: "Fatima" },
        voice: {
          file_id: "AwACAgIAAxkBAA",
          duration: 12,
          mime_type: "audio/ogg",
          file_size: 43210,
        },
      },
    };

    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("voice");
    if (parsed.kind !== "voice") return;
    expect(parsed.isVoice).toBe(true);
    expect(parsed.voiceFileId).toBe("AwACAgIAAxkBAA");
    expect(parsed.voiceDurationSec).toBe(12);
    expect(parsed.voiceMimeType).toBe("audio/ogg");
    expect(parsed.externalId).toBe("telegram:9002:7");
    expect(parsed.fromName).toBe("Fatima");
  });

  it("captures a caption for voice notes (Telegram allows captions)", () => {
    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 8,
        date: 1718800200,
        chat: { id: 9003, type: "private", first_name: "Bilal" },
        from: { id: 9003, is_bot: false, first_name: "Bilal" },
        caption: "payment proof for last invoice",
        voice: {
          file_id: "voiceFileId2",
          duration: 5,
          mime_type: "audio/ogg",
          file_size: 12345,
        },
      },
    };

    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("voice");
    if (parsed.kind !== "voice") return;
    expect(parsed.content).toBe("payment proof for last invoice");
  });

  it("extracts sender info from group chat messages", () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 100,
        date: 1718800300,
        chat: {
          id: -1001234567,
          type: "supergroup",
          title: "Sales Team",
        },
        from: { id: 5555, is_bot: false, first_name: "Sarah", last_name: "K" },
        text: "I'll get the quote out by EOD",
      },
    };

    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("text");
    if (parsed.kind !== "text") return;
    expect(parsed.chatType).toBe("supergroup");
    expect(parsed.chatId).toBe("-1001234567");
    expect(parsed.fromName).toBe("Sarah K");
  });

  it("treats edited_message the same as message", () => {
    const update: TelegramUpdate = {
      update_id: 4,
      edited_message: {
        message_id: 50,
        date: 1718800000,
        edit_date: 1718800900,
        chat: { id: 9004, type: "private", first_name: "Omar" },
        from: { id: 9004, is_bot: false, first_name: "Omar" },
        text: "Updated: delivery by Monday not Friday",
      },
    };

    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("text");
    if (parsed.kind !== "text") return;
    expect(parsed.content).toBe("Updated: delivery by Monday not Friday");
    expect(parsed.externalId).toBe("telegram:9004:50");
  });

  it("skips updates with no message (e.g. callback_query, inline_query)", () => {
    const update: TelegramUpdate = {
      update_id: 5,
      callback_query: {
        id: "cb-1",
        from: { id: 1, is_bot: false, first_name: "x" },
        chat_instance: "abc",
        data: "noop",
      },
    };
    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("skip");
  });

  it("skips updates where message is from a bot", () => {
    const update: TelegramUpdate = {
      update_id: 6,
      message: {
        message_id: 99,
        date: 1718800000,
        chat: { id: 9005, type: "private", first_name: "Bot" },
        from: { id: 9005, is_bot: true, first_name: "LoopBot" },
        text: "echo",
      },
    };
    const parsed = parseTelegramUpdate(update);
    expect(parsed.kind).toBe("skip");
  });
});

describe("extractInboundMessage", () => {
  it("maps a parsed text message into the unified RawMessage shape", () => {
    const parsed = {
      kind: "text" as const,
      externalId: "telegram:1:2",
      fromId: "1",
      fromName: "Test",
      fromUsername: null,
      chatId: "1",
      chatType: "private" as const,
      content: "hello",
      receivedAt: "2024-06-19T00:00:00.000Z",
      isVoice: false,
      mediaUrl: null,
    };

    const raw = extractInboundMessage(parsed, {
      upsertedContactId: "contact-1",
    });
    expect(raw.contact_id).toBe("contact-1");
    expect(raw.external_id).toBe("telegram:1:2");
    expect(raw.channel).toBe("telegram");
    expect(raw.direction).toBe("inbound");
    expect(raw.content).toBe("hello");
    expect(raw.status).toBe("pending");
    expect(raw.metadata).toMatchObject({
      from_id: "1",
      from_name: "Test",
      chat_id: "1",
      chat_type: "private",
    });
  });

  it("maps a parsed voice message including voice metadata", () => {
    const parsed = {
      kind: "voice" as const,
      externalId: "telegram:1:3",
      fromId: "1",
      fromName: null,
      fromUsername: null,
      chatId: "1",
      chatType: "private" as const,
      content: null,
      receivedAt: "2024-06-19T00:00:00.000Z",
      isVoice: true,
      mediaUrl: null,
      voiceFileId: "abc",
      voiceDurationSec: 9,
      voiceMimeType: "audio/ogg",
    };

    const raw = extractInboundMessage(parsed, { upsertedContactId: null });
    expect(raw.channel).toBe("telegram");
    expect(raw.is_voice_note).toBe(true);
    expect(raw.audio_url).toBeNull(); // not yet downloaded
    expect(raw.transcription).toBeNull();
    expect(raw.metadata).toMatchObject({
      voice_file_id: "abc",
      voice_duration_sec: 9,
      voice_mime_type: "audio/ogg",
    });
  });
});

describe("getSecretFromHeader", () => {
  it("reads the X-Telegram-Bot-Api-Secret-Token header value", () => {
    const headers = new Headers({ "X-Telegram-Bot-Api-Secret-Token": "expected-secret" });
    expect(getSecretFromHeader(headers)).toBe("expected-secret");
  });

  it("returns null when header missing", () => {
    expect(getSecretFromHeader(new Headers())).toBeNull();
  });
});

describe("type guards", () => {
  it("isTextMessage detects text updates", () => {
    expect(isTextMessage({ text: "hi" })).toBe(true);
    expect(isTextMessage({ caption: "hi" })).toBe(true);
    expect(isTextMessage({ photo: [] })).toBe(false);
  });

  it("isVoiceMessage detects voice updates", () => {
    expect(isVoiceMessage({ voice: { file_id: "x" } })).toBe(true);
    expect(isVoiceMessage({ text: "hi" })).toBe(false);
  });
});