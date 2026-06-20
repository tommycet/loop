// Email channel parser for Cloudflare Email Workers.
// Cloudflare POSTs a JSON object with `from`, `to`, and `raw` (the full
// RFC822 email) when an email hits a Worker-bound address. We parse the
// raw payload here into a normalized inbound message and provide a
// constant-time secret check.

export interface ParsedEmail {
  from: string;
  from_name: string | null;
  to: string;
  subject: string;
  body: string;
  message_id: string | null;
  date: string | null;
}

export interface EmailInbound {
  channel: "email";
  external_id: string;
  content: string;
  contact_handle: string;
  raw: string;
}

function decodeQuotedPrintable(input: string): string {
  // Strip soft line breaks: "=\r\n" or "=\n" (RFC 2045 §6.7).
  // The "=" is removed AND the newline is removed (the line continues
  // directly into the next).
  return input.replace(/=\r?\n/g, "");
}

function extractHeader(headers: string, name: string): string {
  // Match "Name: value" possibly continuing on folded lines.
  const re = new RegExp(`^${name}\\s*:\\s*(.+?(?:\\r?\\n[ \\t].+?)*)$`, "im");
  const m = headers.match(re);
  if (!m) return "";
  // Unfold continuation lines.
  return m[1].replace(/\r?\n[ \t]+/g, " ").trim();
}

export function parseEmailWorkerPayload(raw: string): ParsedEmail {
  // Split headers from body at the first blank line.
  const splitIdx = raw.search(/\r?\n\r?\n/);
  let headerBlock = raw;
  let body = "";
  if (splitIdx >= 0) {
    headerBlock = raw.slice(0, splitIdx);
    body = raw.slice(splitIdx).replace(/^\r?\n\r?\n/, "");
  }

  const from = extractHeader(headerBlock, "From");
  const to = extractHeader(headerBlock, "To");
  const subject = extractHeader(headerBlock, "Subject");
  const messageId = extractHeader(headerBlock, "Message-ID") || extractHeader(headerBlock, "Message-Id");
  const date = extractHeader(headerBlock, "Date");

  // From: "Name" <addr@x.com>  OR  addr@x.com
  let fromAddr = from;
  let fromName: string | null = null;
  const angleMatch = from.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (angleMatch) {
    fromName = angleMatch[1].trim() || null;
    fromAddr = angleMatch[2].trim();
  }

  // Decode QP body if header indicated it.
  const cte = extractHeader(headerBlock, "Content-Transfer-Encoding").toLowerCase();
  let decodedBody = body;
  if (cte === "quoted-printable") {
    decodedBody = decodeQuotedPrintable(body);
  }

  return {
    from: fromAddr,
    from_name: fromName,
    to,
    subject,
    body: decodedBody.trim(),
    message_id: messageId || null,
    date: date || null,
  };
}

export function extractInboundFromEmail(
  raw: string,
  opts: { channelPrefix?: string } = {}
): EmailInbound {
  const parsed = parseEmailWorkerPayload(raw);
  const channelPrefix = opts.channelPrefix || "email";
  // Compose content: prefer body, fall back to subject.
  const content = parsed.body || parsed.subject || "(empty email)";
  const externalId = parsed.message_id || `${channelPrefix}-synthetic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    channel: "email",
    external_id: externalId,
    content,
    contact_handle: parsed.from,
    raw,
  };
}

// Constant-time string compare (avoids early-return timing leak).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a full pass to keep timing close — pad to the longer length.
    const longer = Math.max(a.length, b.length);
    let mismatch = 1;
    for (let i = 0; i < longer; i++) {
      mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return mismatch === 0;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isValidEmailWorkerSecret(configured: string | undefined, provided: string | undefined): boolean {
  if (!configured) return false;
  if (!provided) return false;
  return timingSafeEqual(configured, provided);
}