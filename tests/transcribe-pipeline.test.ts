/**
 * Tests for /api/transcribe/[id] endpoint.
 *
 * We test the resolver that maps a stored message ID to a downloadable URL
 * and the persisted-update logic. The actual Groq API call is mocked so
 * tests don't hit the network.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  type TranscribableMessage,
  resolveMessageAudio,
  transcribeAndUpdate,
} from "../src/lib/channels/transcribe-pipeline";

describe("resolveMessageAudio", () => {
  it("returns the message's stored audio_url when present", () => {
    const msg: TranscribableMessage = {
      id: "m1",
      channel: "telegram",
      audio_url: "https://example.com/audio.ogg",
      transcription: null,
    };
    expect(resolveMessageAudio(msg)).toEqual({
      ok: true,
      url: "https://example.com/audio.ogg",
    });
  });

  it("returns needs-telegram-resolve when audio_url is null but voice_file_id is in metadata", () => {
    const msg: TranscribableMessage = {
      id: "m2",
      channel: "telegram",
      audio_url: null,
      transcription: null,
      metadata: { voice_file_id: "file-xyz" },
    };
    const r = resolveMessageAudio(msg);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("needs-telegram-resolve");
    expect(r.fileId).toBe("file-xyz");
  });

  it("returns not-a-voice-note when no audio fields are present", () => {
    const msg: TranscribableMessage = {
      id: "m3",
      channel: "whatsapp",
      audio_url: null,
      transcription: null,
    };
    const r = resolveMessageAudio(msg);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("not-a-voice-note");
  });

  it("returns already-transcribed when transcription is set", () => {
    const msg: TranscribableMessage = {
      id: "m4",
      channel: "telegram",
      audio_url: "https://example.com/audio.ogg",
      transcription: "I can give 10% off",
    };
    const r = resolveMessageAudio(msg);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("already-transcribed");
  });
});

describe("transcribeAndUpdate", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("audio.ogg")) {
          // Simulated audio bytes
          return new Response(new Uint8Array([1, 2, 3, 4, 5]), {
            status: 200,
            headers: { "content-type": "audio/ogg" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the pre-existing transcription if already set (idempotent)", async () => {
    const msg: TranscribableMessage = {
      id: "m5",
      channel: "telegram",
      audio_url: "https://example.com/audio.ogg",
      transcription: "already done",
    };
    const result = await transcribeAndUpdate(msg, {
      transcribeFn: async () => "fresh text",
      onUpdate: () => {},
    });
    expect(result.transcription).toBe("already done");
    expect(result.cached).toBe(true);
  });

  it("calls transcribeFn with the audio bytes when no transcription set", async () => {
    const calls: Array<{ mime: string; bytes: Uint8Array }> = [];
    const msg: TranscribableMessage = {
      id: "m6",
      channel: "telegram",
      audio_url: "https://example.com/audio.ogg",
      transcription: null,
      metadata: { voice_mime_type: "audio/ogg" },
    };
    const result = await transcribeAndUpdate(msg, {
      transcribeFn: async ({ bytes, mimeType }) => {
        calls.push({ mime: mimeType, bytes });
        return "freshly transcribed";
      },
      onUpdate: () => {},
    });
    expect(result.transcription).toBe("freshly transcribed");
    expect(result.cached).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].mime).toBe("audio/ogg");
  });

  it("invokes onUpdate with the new transcription", async () => {
    const updates: Array<{ id: string; text: string }> = [];
    const msg: TranscribableMessage = {
      id: "m7",
      channel: "telegram",
      audio_url: "https://example.com/audio.ogg",
      transcription: null,
    };
    await transcribeAndUpdate(msg, {
      transcribeFn: async () => "hello world",
      onUpdate: (id, text) => {
        updates.push({ id, text });
      },
    });
    expect(updates).toEqual([{ id: "m7", text: "hello world" }]);
  });
});