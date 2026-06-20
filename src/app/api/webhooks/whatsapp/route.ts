import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";

export const dynamic = "force-dynamic";

interface WappflyWebhook {
  event: string;
  timestamp: number;
  session: { id: number };
  data: {
    messages: {
      key: {
        id: string;
        fromMe: boolean;
        remoteJid: string;
        cleanedSenderPn?: string;
        senderPn?: string;
      };
      messageBody: string | null;
      message: Record<string, unknown>;
      messageTimestamp: number;
      pushName?: string;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: WappflyWebhook = await req.json();

    // Only process inbound messages
    if (body.event !== "messages.received") {
      return NextResponse.json({ ok: true, skipped: body.event });
    }

    const msg = body.data.messages;
    if (msg.key.fromMe) {
      // Outbound echo - skip to avoid re-ingestion
      return NextResponse.json({ ok: true, skipped: "outbound" });
    }

    const phone = msg.key.cleanedSenderPn || msg.key.senderPn?.replace("@s.whatsapp.net", "") || msg.key.remoteJid.replace("@s.whatsapp.net", "");
    const name = msg.pushName || null;
    const content = msg.messageBody || "";
    const externalId = msg.key.id;

    const supabase = getSupabase();

    // 1. Upsert contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .upsert({ phone, name }, { onConflict: "phone" })
      .select()
      .single();

    if (contactError) {
      console.error("Contact upsert error:", contactError);
      return NextResponse.json({ ok: false, error: contactError.message }, { status: 500 });
    }

    // 2. Check for duplicate message
    const { data: existing } = await supabase
      .from("raw_messages")
      .select("id")
      .eq("external_id", externalId)
      .single();

    if (existing) {
      return NextResponse.json({ ok: true, skipped: "duplicate" });
    }

    // 3. Insert message
    const { data: message, error: msgError } = await supabase
      .from("raw_messages")
      .insert({
        contact_id: contact.id,
        external_id: externalId,
        channel: "whatsapp",
        direction: "inbound",
        content,
        status: "pending",
        raw_payload: body,
      })
      .select()
      .single();

    if (msgError) {
      console.error("Message insert error:", msgError);
      return NextResponse.json({ ok: false, error: msgError.message }, { status: 500 });
    }

    // 4. Trigger Inngest event for processing
    try {
      await inngest.send({
        name: "message.received",
        data: {
          messageId: message.id,
          contactId: contact.id,
        },
      });
    } catch (e) {
      console.error("Inngest send error (non-fatal):", e);
    }

    return NextResponse.json({ ok: true, messageId: message.id, contactId: contact.id });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "whatsapp-webhook", ready: true });
}
