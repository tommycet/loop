import { NextRequest, NextResponse } from "next/server";

import {
  type RawMessageWithMeta,
  buildMetaContactMetadata,
  extractInboundMessage as extractMeta,
  parseMetaWebhook,
} from "@/lib/channels/whatsapp-meta";
import { runInlineDetectionDemo } from "@/lib/channels/inline-detect";
import { readDemoState, writeDemoState } from "@/lib/demo-state";
import { safeSupabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * POST /api/inbound/whatsapp-meta
 *
 * Direct Meta WhatsApp Cloud API webhook endpoint. The existing
 * /api/webhooks/whatsapp uses the Wappfly wrapper; this is the
 * alternative for operators who connect their own Meta WhatsApp Business
 * App without a BSP.
 *
 * Verifies the X-Hub-Signature-256 header against META_APP_SECRET when
 * configured (defense-in-depth; Meta also supports the verify_token
 * challenge handshake for initial webhook registration).
 *
 * GET: returns the verification challenge Meta sends during webhook
 * registration if META_VERIFY_TOKEN matches.
 */
export async function POST(req: NextRequest) {
  // Signature verification
  if (process.env.META_APP_SECRET) {
    const sigHeader = req.headers.get("x-hub-signature-256");
    if (!sigHeader || !sigHeader.startsWith("sha256=")) {
      return NextResponse.json(
        { ok: false, error: "missing signature" },
        { status: 401 },
      );
    }
    const provided = sigHeader.slice("sha256=".length);
    const body = await req.text();
    // Re-attach body for json parse below
    const expected = await hmacSha256(process.env.META_APP_SECRET, body);
    if (!constantTimeEqual(provided, expected)) {
      return NextResponse.json(
        { ok: false, error: "invalid signature" },
        { status: 401 },
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = parseMetaWebhook(body);
  if (parsed.kind === "skip") {
    return NextResponse.json({ ok: true, skipped: parsed.reason });
  }

  const message = extractMeta(parsed, { upsertedContactId: null });
  const supabase = safeSupabase();
  if (!supabase) {
    return persistDemoState(message);
  }
  return persistSupabase(supabase, message, parsed);
}

export async function GET(req: NextRequest) {
  // Webhook verification handshake.
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && challenge) {
    if (token === process.env.META_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "verify_token mismatch" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    endpoint: "whatsapp-meta-webhook",
    ready: true,
    signatureVerification: Boolean(process.env.META_APP_SECRET),
  });
}

// ─── Persistence ──────────────────────────────────────────────────────────

function persistDemoState(message: RawMessageWithMeta): NextResponse {
  const state = readDemoState();
  if (state.messages.some((m) => m.external_id === message.external_id)) {
    return NextResponse.json({ ok: true, skipped: "duplicate", messageId: message.id });
  }
  const stored = {
    id: message.id,
    contact_id: message.contact_id ?? null,
    external_id: message.external_id,
    channel: message.channel,
    direction: message.direction,
    content: message.content ?? null,
    media_url: message.media_url ?? null,
    audio_url: message.audio_url ?? null,
    status: message.status,
    raw_payload: { ...message.raw_payload, metadata: message.metadata },
    created_at: message.created_at,
  };
  state.messages.unshift(stored as (typeof state.messages)[number]);
  writeDemoState(state);

  // Real-time inline detection (shared with Telegram webhook).
  const fromName = parsedFromName(stored.raw_payload);
  runInlineDetectionDemo(stored.id, fromName);

  return NextResponse.json({ ok: true, demoMode: true, messageId: message.id });
}

function parsedFromName(rawPayload: Record<string, unknown> | unknown): string | null {
  const meta = (rawPayload as { metadata?: { from_name?: string } })?.metadata;
  return meta?.from_name ?? null;
}

async function persistSupabase(
  supabase: ReturnType<typeof safeSupabase> & object,
  message: RawMessageWithMeta,
  parsed: ReturnType<typeof parseMetaWebhook>,
): Promise<NextResponse> {
  const phone = (parsed as any).fromPhone ?? null;
  const name = (parsed as any).fromName ?? null;
  const metadata = buildMetaContactMetadata(parsed as any);

  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .upsert({ phone, name, metadata }, { onConflict: "phone" })
    .select()
    .single();
  if (contactErr) {
    return NextResponse.json(
      { error: `contact upsert: ${contactErr.message}` },
      { status: 500 },
    );
  }
  message.contact_id = contact?.id ?? null;

  const { data: existing } = await supabase
    .from("raw_messages")
    .select("id")
    .eq("external_id", message.external_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "duplicate", messageId: existing.id });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("raw_messages")
    .insert({
      contact_id: message.contact_id,
      external_id: message.external_id,
      channel: message.channel,
      direction: message.direction,
      content: message.content,
      media_url: message.media_url,
      audio_url: message.audio_url,
      status: message.status,
      raw_payload: { ...message.raw_payload, metadata: message.metadata },
    })
    .select()
    .single();
  if (insertErr) {
    return NextResponse.json(
      { error: `message insert: ${insertErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: inserted.id,
    contactId: message.contact_id,
  });
}

// ─── Crypto helpers ───────────────────────────────────────────────────────

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}