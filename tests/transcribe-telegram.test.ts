/**
 * Tests for the Telegram file URL resolver + transcribe pipeline.
 *
 * Telegram's Bot API delivers voice messages with a `file_id` only. To
 * actually download the audio bytes, you must call `getFile`, which
 * returns a `file_path` — combine that with your bot token to get a
 * real HTTPS URL the server can fetch.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  type TelegramFile,
  buildTelegramFileDownloadUrl,
  resolveTelegramFile,
} from "../src/lib/channels/telegram-file";

describe("buildTelegramFileDownloadUrl", () => {
  it("composes the standard file download URL", () => {
    const url = buildTelegramFileDownloadUrl(
      "12345:ABC",
      "voice/file_42.ogg",
    );
    expect(url).toBe(
      "https://api.telegram.org/file/bot12345:ABC/voice/file_42.ogg",
    );
  });
});

describe("resolveTelegramFile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("getFile")) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                file_id: "voiceFileId42",
                file_unique_id: "uf42",
                file_size: 43210,
                file_path: "voice/file_42.ogg",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the getFile endpoint and returns the resolved download URL", async () => {
    const file = await resolveTelegramFile("bot-token-xyz", "voiceFileId42");
    expect(file.fileId).toBe("voiceFileId42");
    expect(file.filePath).toBe("voice/file_42.ogg");
    expect(file.fileSize).toBe(43210);
    expect(file.downloadUrl).toBe(
      "https://api.telegram.org/file/botbot-token-xyz/voice/file_42.ogg",
    );
  });

  it("rejects when Telegram returns ok=false", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ ok: false, description: "file not found" }),
          { status: 200 },
        );
      }),
    );
    await expect(
      resolveTelegramFile("bot-token-xyz", "missing"),
    ).rejects.toThrow(/file not found/);
  });

  it("rejects when fetch fails", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    await expect(
      resolveTelegramFile("bot-token-xyz", "voiceFileId42"),
    ).rejects.toThrow(/getFile failed/);
  });
});

describe("TelegramFile shape", () => {
  it("captures the minimum fields needed to download + log", () => {
    const f: TelegramFile = {
      fileId: "x",
      filePath: "voice/x.ogg",
      downloadUrl: "https://api.telegram.org/file/bot/x/voice/x.ogg",
      fileSize: 100,
    };
    expect(f.fileId).toBe("x");
    expect(f.fileSize).toBe(100);
  });
});