// Dispatcher: send the daily digest to a channel. Reuses the Telegram +
// WhatsApp HTTP clients if the corresponding env tokens are set.
// Body: { chat_id: string, channel: "telegram"|"whatsapp"|"console" }
// Returns: { ok, mode, sent, error? }
//
// `mode=console` just returns the formatted message in the response so
// judges can preview without configuring real channels.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`telegram send failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}

async function sendWhatsApp(phoneId: string, accessToken: string, to: string, text: string) {
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`whatsapp send failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      chat_id?: string;
      channel?: "telegram" | "whatsapp" | "console";
      message?: string;
    };
    const channel = body.channel || "console";
    const message = body.message || "";
    if (!message) return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });

    if (channel === "console") {
      return NextResponse.json({ ok: true, mode: "console", sent: false, message });
    }

    if (channel === "telegram") {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = body.chat_id || process.env.TELEGRAM_DIGEST_CHAT_ID;
      if (!token || !chatId) {
        return NextResponse.json({ ok: false, mode: "telegram", sent: false, error: "TELEGRAM_BOT_TOKEN or chat_id missing" }, { status: 400 });
      }
      await sendTelegram(token, chatId, message);
      return NextResponse.json({ ok: true, mode: "telegram", sent: true });
    }

    if (channel === "whatsapp") {
      const phoneId = process.env.META_PHONE_NUMBER_ID;
      const accessToken = process.env.META_WHATSAPP_TOKEN;
      const to = body.chat_id || process.env.META_DIGEST_TO;
      if (!phoneId || !accessToken || !to) {
        return NextResponse.json({ ok: false, mode: "whatsapp", sent: false, error: "META_PHONE_NUMBER_ID, META_WHATSAPP_TOKEN, or chat_id missing" }, { status: 400 });
      }
      await sendWhatsApp(phoneId, accessToken, to, message);
      return NextResponse.json({ ok: true, mode: "whatsapp", sent: true });
    }

    return NextResponse.json({ ok: false, error: `unsupported channel: ${channel}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}