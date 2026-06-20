import { NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import { sendMessage } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

const TEAM_MEMBERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sarah (Sales)", team: "sales", phone: null },
  { id: "22222222-2222-2222-2222-222222222222", name: "Omar (Ops)", team: "operations", phone: null },
  { id: "33333333-3333-3333-3333-333333333333", name: "Fatima (Finance)", team: "finance", phone: null },
  { id: "44444444-4444-4444-4444-444444444444", name: "Ahmed (Admin)", team: "admin", phone: null },
];

export async function POST() {
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    const now = Date.now();
    
    // Find overdue tasks with follow-ups pending
    const overdueTasks = state.tasks.filter(t => 
      t.due_at && new Date(t.due_at).getTime() < now && t.status !== "done"
    );
    
    const results = [];
    
    for (const task of overdueTasks) {
      const owner = TEAM_MEMBERS.find(m => m.id === task.owner_id);
      const ownerName = owner?.name || "Unassigned";
      
      // Try to send WhatsApp reminder (only if we have a phone - use the session's own number for demo)
      try {
        const message = `Loop Reminder: Task "${task.title}" is overdue (was due ${new Date(task.due_at!).toLocaleDateString()}). Owner: ${ownerName}. Please take action.`;
        
        // Send to the connected WhatsApp number (self-reminder for demo)
        const result = await sendMessage("923349566383", message);
        
        // Create a follow-up record
        state.approvals.unshift({
          id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          task_id: task.id,
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          escalation_level: 1,
          channel: "whatsapp",
          message_draft: message,
          status: "sent",
          created_at: new Date().toISOString(),
        });
        
        results.push({ taskId: task.id, title: task.title, sent: true, msgId: result.msg_id });
      } catch (error: any) {
        results.push({ taskId: task.id, title: task.title, sent: false, error: error.message });
      }
    }
    
    writeDemoState(state);
    
    return NextResponse.json({
      ok: true,
      mode: "demo",
      totalOverdue: overdueTasks.length,
      remindersSent: results.filter(r => r.sent).length,
      results,
    });
  }
  
  return NextResponse.json({ ok: true, mode: "live" });
}
