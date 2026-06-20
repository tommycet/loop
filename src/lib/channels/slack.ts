// Slack channel parser for the Events API webhook (HTTP-based).
// For production Socket Mode, use @slack/bolt — but the webhook format
// is identical, so this parser works for both.
//
// Auth: Slack signs requests with `X-Slack-Signature: v0=<hmac-sha256>`.
// We verify it with the SLACK_SIGNING_SECRET env var. If unset, we
// reject all requests (fail-closed).

import crypto from "node:crypto";

export interface ParsedSlackEvent {
  type: string | null;        // 'message' | null for challenges
  user: string | null;
  text: string | null;
  ts: string | null;
  channel_id: string | null;
  channel_type?: string | null;
  challenge?: string;
}

export interface SlackInbound {
  channel: "slack";
  external_id: string;
  content: string;
  contact_handle: string;
  raw: unknown;
}

export function parseSlackEventPayload(payload: any): ParsedSlackEvent {
  if (!payload || typeof payload !== "object") {
    return { type: null, user: null, text: null, ts: null, channel_id: null };
  }
  // URL verification handshake.
  if (payload.type === "url_verification" && typeof payload.challenge === "string") {
    return {
      type: null,
      user: null,
      text: null,
      ts: null,
      channel_id: null,
      challenge: payload.challenge,
    };
  }
  // Event callback wrapper.
  if (payload.type === "event_callback" && payload.event) {
    const evt = payload.event;
    if (evt.type !== "message") {
      return { type: null, user: null, text: null, ts: null, channel_id: null };
    }
    return {
      type: "message",
      user: typeof evt.user === "string" ? evt.user : null,
      text: typeof evt.text === "string" ? evt.text : null,
      ts: typeof evt.ts === "string" ? evt.ts : null,
      channel_id: typeof evt.channel === "string" ? evt.channel : null,
      channel_type: typeof evt.channel_type === "string" ? evt.channel_type : null,
    };
  }
  return { type: null, user: null, text: null, ts: null, channel_id: null };
}

export function extractInboundFromSlack(payload: any): SlackInbound | null {
  const parsed = parseSlackEventPayload(payload);
  if (parsed.type !== "message") return null;
  const event = payload?.event;
  // Skip bot messages.
  if (event?.subtype === "bot_message") return null;
  if (!parsed.text || !parsed.ts) return null;
  return {
    channel: "slack",
    external_id: `slack:${parsed.ts}`,
    content: parsed.text,
    contact_handle: parsed.user || "unknown",
    raw: payload,
  };
}

export function isValidSlackSigningSecret(
  secret: string | undefined,
  signature: string | undefined,
  timestamp?: string,
  body?: string,
): boolean {
  if (!secret) return false;
  if (!signature) return false;
  if (!timestamp || !body) return false; // Need raw body + timestamp to compute HMAC.
  const parts = signature.split("=");
  if (parts.length !== 2 || parts[0] !== "v0") return false;
  const provided = parts[1];
  // Slack's signing algorithm: v0=<hex(HMAC_SHA256(signing_secret, "v0:" + timestamp + ":" + body))>
  const base = `v0:${timestamp}:${body}`;
  const computed = crypto.createHmac("sha256", secret).update(base).digest("hex");
  // Constant-time compare.
  if (computed.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}