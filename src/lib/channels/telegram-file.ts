/**
 * Telegram Bot API file resolver.
 *
 * Telegram voice notes (and other media) are delivered via webhook as a
 * `file_id`. To actually download the bytes you must call:
 *
 *     https://api.telegram.org/bot<BOT_TOKEN>/getFile?file_id=<FILE_ID>
 *
 * which returns:
 *
 *     { ok: true, result: { file_id, file_path, file_size, ... } }
 *
 * The `file_path` is relative — combine it with your bot token to get a
 * real download URL:
 *
 *     https://api.telegram.org/file/bot<BOT_TOKEN>/<file_path>
 *
 * Note: Telegram download URLs are only valid for ~1 hour. For long
 * pipelines, download the bytes immediately and store them somewhere
 * durable (S3, Supabase Storage) rather than holding the URL.
 */

export interface TelegramFile {
  fileId: string;
  filePath: string;
  downloadUrl: string;
  fileSize: number | null;
}

const API_BASE = "https://api.telegram.org";

/**
 * Pure: compose the public download URL from a bot token and a file_path.
 * Exported separately so it can be tested without any I/O.
 */
export function buildTelegramFileDownloadUrl(
  botToken: string,
  filePath: string,
): string {
  return `${API_BASE}/file/bot${botToken}/${filePath}`;
}

/**
 * Resolve a Telegram file_id to a downloadable URL by calling getFile.
 *
 * Throws on:
 *   - network failures
 *   - non-2xx HTTP status
 *   - Telegram returning { ok: false, description: ... }
 *
 * The caller is responsible for handling the case where the bot token
 * isn't configured (return null instead of calling this).
 */
export async function resolveTelegramFile(
  botToken: string,
  fileId: string,
): Promise<TelegramFile> {
  const url = `${API_BASE}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram getFile failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: {
      file_id: string;
      file_path: string;
      file_size?: number;
    };
  };
  if (!body.ok || !body.result?.file_path) {
    throw new Error(
      `Telegram getFile error: ${body.description ?? "missing file_path"}`,
    );
  }
  const { file_id, file_path, file_size } = body.result;
  return {
    fileId: file_id,
    filePath: file_path,
    downloadUrl: buildTelegramFileDownloadUrl(botToken, file_path),
    fileSize: file_size ?? null,
  };
}