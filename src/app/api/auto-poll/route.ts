import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { getRecentMessages } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

// GET /api/auto-poll - Continuously polls Wappfly and ingests new messages
// Returns: { totalReceived, totalStored, results }
// Use with Vercel Cron or external cron (every 1 min)
export async function GET() {
  try {
    const supabase = safeSupabase();
    const recent = await getRecentMessages(50);
    const inbound = recent.filter((m: any) => m.from_me === 0);

    if (!supabase) {
      return NextResponse.json({
        ok: true,
        mode: "demo",
        totalReceived: inbound.length,
        totalStored: 0,
        message: "Demo mode — not stored",
      });
    }

    let stored = 0;
    for (const msg of inbound) {
      const externalId = msg.msg_id;
      if (!externalId) continue;

      // Check if already stored
      const { data: existing } = await supabase
        .from("raw_messages")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();

      if (existing) continue;

      const phone = msg.sender_jid?.replace("@s.whatsapp.net", "") || "";
      const content = msg.body || "";

      // Find/create contact
      let { data: contact } = await supabase
        .from("contacts")
        .select()
        .eq("phone", phone)
        .maybeSingle();

      if (!contact && phone) {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({ name: phone, phone, metadata: { source: "whatsapp" } })
          .select()
          .single();
        contact = newContact;
      }

      if (!contact) continue;

      // Store message with status pending
      const { error: insertErr } = await supabase.from("raw_messages").insert({
        contact_id: contact.id,
        external_id: externalId,
        channel: "whatsapp",
        direction: "inbound",
        content,
        status: "pending",
        raw_payload: msg,
      });

      if (!insertErr) stored++;
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      totalReceived: inbound.length,
      totalStored: stored,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
