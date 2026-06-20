// POST /api/inbound/email — receive a raw RFC822 email payload from a
// Cloudflare Email Worker. Body can be:
//   1. application/json: { from, to, raw }       (the CF worker format)
//   2. text/plain:        <raw RFC822>           (some workers just POST the raw)
//
// Authentication: x-email-secret header (constant-time compared against
// EMAIL_WEBHOOK_SECRET env). If secret is unset, the route fails closed.

import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { extractInboundFromEmail, isValidEmailWorkerSecret } from "../../../../lib/channels/email";
import { runInlineDetectionDemo } from "../../../../lib/channels/inline-detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Auth check.
  // In dev (FORCE_DEMO_MODE=true or NODE_ENV=development), allow requests
  // through with a warning so local testing works without configuring the
  // secret. In production, fail closed if the secret isn't set.
  const provided = req.headers.get("x-email-secret") || undefined;
  const configured = process.env.EMAIL_WEBHOOK_SECRET;
  if (!isValidEmailWorkerSecret(configured, provided)) {
    const isDev = process.env.FORCE_DEMO_MODE === "true" || process.env.NODE_ENV === "development";
    if (isDev && !configured) {
      console.warn(
        "[email-inbound] dev mode: EMAIL_WEBHOOK_SECRET not set, accepting unauthenticated request. Set the secret in .env.local for production.",
      );
    } else {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // Parse payload (either JSON envelope or raw body).
  const ct = req.headers.get("content-type") || "";
  let rawEmail: string;
  let envelopeFrom: string | null = null;
  let envelopeTo: string | null = null;
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { from?: string; to?: string; raw?: string } | null;
    if (!body || !body.raw) {
      return NextResponse.json({ error: "raw email body required" }, { status: 400 });
    }
    rawEmail = body.raw;
    envelopeFrom = body.from || null;
    envelopeTo = body.to || null;
  } else {
    rawEmail = await req.text();
  }
  if (!rawEmail.trim()) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  const inbound = extractInboundFromEmail(rawEmail);
  // Prefer envelope from/to when CF provides them (more reliable than parsing).
  if (envelopeFrom) inbound.contact_handle = envelopeFrom;

  // Persist as a raw_message in demo state and run inline detection.
  const state = readDemoState();
  const msgId = `msg-email-${inbound.external_id.replace(/[<>@]/g, "_").slice(0, 60)}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const message = {
    id: msgId,
    contact_id: inbound.contact_handle,
    external_id: inbound.external_id,
    channel: "email" as const,
    direction: "inbound" as const,
    content: inbound.content,
    status: "pending" as const,
    raw_payload: { raw: rawEmail.slice(0, 4000) },
    created_at: createdAt,
  };
  state.messages.push(message);
  writeDemoState(state);

  // Inline detection — same pipeline Telegram + Meta WhatsApp use.
  const detection = runInlineDetectionDemo(
    msgId,
    inbound.contact_handle,
  );

  return NextResponse.json({
    ok: true,
    message: { id: msgId, channel: "email", external_id: inbound.external_id, content: inbound.content.slice(0, 200) },
    detection,
  });
}

// GET returns a friendly handshake for CF worker debugging.
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "email-inbound",
    auth: process.env.EMAIL_WEBHOOK_SECRET ? "required" : "not configured (rejects all requests)",
  });
}