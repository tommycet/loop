import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import { sendMessage } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { id, phone } = await req.json();
  
  const supabase = safeSupabase();
  
  if (!supabase) {
    // Demo mode: send via Wappfly + update approval status
    const state = readDemoState();
    const approval = state.approvals.find(a => a.id === id);
    
    if (!approval) {
      return NextResponse.json({ ok: false, error: "Approval not found" }, { status: 404 });
    }
    
    if (!phone) {
      return NextResponse.json({ ok: false, error: "Phone number required to send WhatsApp message" }, { status: 400 });
    }
    
    try {
      const result = await sendMessage(phone, approval.message_draft || "Follow up from Loop");
      
      // Update approval status
      approval.status = "sent";
      approval.sent_at = new Date().toISOString();
      writeDemoState(state);
      
      return NextResponse.json({
        ok: true,
        approval: { id: approval.id, status: approval.status, sent_at: approval.sent_at },
        wappfly: result,
      });
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  
  // Live mode
  try {
    const { data: approval, error } = await supabase
      .from("follow_ups")
      .select("*, tasks!inner(contact_id)")
      .eq("id", id)
      .single();
    
    if (error || !approval) {
      return NextResponse.json({ ok: false, error: "Approval not found" }, { status: 404 });
    }
    
    const result = await sendMessage(phone, approval.message_draft || "Follow up from Loop");
    
    await supabase
      .from("follow_ups")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    
    return NextResponse.json({ ok: true, wappfly: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
