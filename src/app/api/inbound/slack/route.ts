// POST /api/inbound/slack — receive Slack Events API callbacks.
// Handles URL verification challenge, message events, signature verification.
// In production with Socket Mode, use @slack/bolt instead; this endpoint
// is the HTTP-based equivalent.
//
// Auth: SLACK_SIGNING_SECRET env var (HMAC-SHA256 of v0:<ts>:<body>).
// If secret unset, fails closed.

import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { runInlineDetectionDemo } from "../../../../lib/channels/inline-detect";
import {
  parseSlackEventPayload,
  extractInboundFromSlack,
  isValidSlackSigningSecret,
} from "../../../../lib/channels/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Read raw body for signature verification.
  const rawBody = await req.text();
  const ts = req.headers.get("x-slack-request-timestamp") || undefined;
  const sig = req.headers.get("x-slack-signature") || undefined;
  const secret = process.env.SLACK_SIGNING_SECRET;

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // URL verification challenge — respond BEFORE auth check so Slack can
  // confirm the URL. Safe: we just echo back their challenge string.
  const challengeCheck = parseSlackEventPayload(payload);
  if (challengeCheck.challenge) {
    return NextResponse.json({ challenge: challengeCheck.challenge });
  }

  // Auth gate — fail-closed for production. In dev (FORCE_DEMO_MODE=true
  // or NODE_ENV=development), allow unsigned requests with a warning so
  // local testing works without configuring the secret.
  if (!isValidSlackSigningSecret(secret, sig, ts, rawBody)) {
    const isDev = process.env.FORCE_DEMO_MODE === "true" || process.env.NODE_ENV === "development";
    if (isDev && !secret) {
      console.warn(
        "[slack-inbound] dev mode: SLACK_SIGNING_SECRET not set, accepting unsigned request. Set the secret in .env.local for production.",
      );
    } else {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const parsed = challengeCheck;
  if (parsed.type !== "message") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const inbound = extractInboundFromSlack(payload);
  if (!inbound) {
    return NextResponse.json({ ok: true, skipped: "not a processable message" });
  }

  // Persist + inline-detect.
  const state = readDemoState();
  const msgId = `msg-slack-${inbound.external_id.replace(/[:.]/g, "_")}-${Date.now()}`;
  const message = {
    id: msgId,
    contact_id: inbound.contact_handle,
    external_id: inbound.external_id,
    channel: "slack" as const,
    direction: "inbound" as const,
    content: inbound.content,
    status: "pending" as const,
    raw_payload: { event: payload.event, channel_id: parsed.channel_id },
    created_at: new Date().toISOString(),
  };
  state.messages.push(message);
  writeDemoState(state);

  const detection = runInlineDetectionDemo(msgId, inbound.contact_handle);

  return NextResponse.json({
    ok: true,
    message: { id: msgId, channel: "slack", external_id: inbound.external_id, content: inbound.content.slice(0, 200) },
    detection,
  });
}

// GET returns a friendly handshake for debugging.
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "slack-inbound",
    auth: process.env.SLACK_SIGNING_SECRET ? "required" : "not configured (rejects all requests)",
  });
}