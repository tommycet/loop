import { NextRequest, NextResponse } from "next/server";
import { readDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("id");
  const phone = req.nextUrl.searchParams.get("phone");
  
  if (!contactId && !phone) {
    return NextResponse.json({ ok: false, error: "Provide id or phone parameter" }, { status: 400 });
  }
  
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    
    let contact = contactId 
      ? state.contacts.find(c => c.id === contactId)
      : state.contacts.find(c => c.phone === phone);
    
    if (!contact) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    
    const messages = state.messages
      .filter(m => m.contact_id === contact.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const tasks = state.tasks
      .filter(t => t.contact_id === contact.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const followUps = state.approvals
      .filter(a => tasks.some(t => t.id === a.task_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Build unified timeline
    const timeline = [
      ...messages.map(m => ({ type: "message", timestamp: m.created_at, data: m })),
      ...tasks.map(t => ({ type: "task", timestamp: t.created_at, data: t })),
      ...followUps.map(f => ({ type: "followup", timestamp: f.created_at, data: f })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      ok: true,
      contact,
      summary: {
        totalMessages: messages.length,
        totalTasks: tasks.length,
        openTasks: tasks.filter(t => t.status !== "done").length,
        overdueTasks: tasks.filter(t => t.due_at && new Date(t.due_at).getTime() < Date.now() && t.status !== "done").length,
        followUps: followUps.length,
      },
      timeline,
    });
  }
  
  return NextResponse.json({ ok: true, mode: "live", message: "Live timeline not implemented" });
}
