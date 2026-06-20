import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    const now = Date.now();
    
    // Find all overdue tasks that haven't been escalated yet
    const overdueTasks = state.tasks.filter(t => 
      t.due_at && 
      new Date(t.due_at).getTime() < now && 
      t.status !== "done"
    );
    
    // Check which already have escalation follow-ups
    const escalatedTaskIds = new Set(
      state.approvals
        .filter(a => a.escalation_level > 0)
        .map(a => a.task_id)
    );
    
    const needsEscalation = overdueTasks.filter(t => !escalatedTaskIds.has(t.id));
    
    // Auto-create escalation follow-ups
    for (const task of needsEscalation) {
      state.approvals.unshift({
        id: `escalation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        task_id: task.id,
        scheduled_at: new Date().toISOString(),
        sent_at: null,
        escalation_level: 1,
        channel: "app",
        message_draft: `ESCALATED: Task "${task.title}" is overdue and needs immediate attention.`,
        status: "scheduled",
        created_at: new Date().toISOString(),
      });
    }
    
    if (needsEscalation.length > 0) {
      writeDemoState(state);
    }
    
    return NextResponse.json({
      ok: true,
      mode: "demo",
      overdueTasks: overdueTasks.length,
      alreadyEscalated: escalatedTaskIds.size,
      newlyEscalated: needsEscalation.length,
      totalEscalations: overdueTasks.length,
    });
  }
  
  // Live mode
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id")
    .lt("due_at", new Date().toISOString())
    .neq("status", "done");
  
  const { data: existingEscalations } = await supabase
    .from("follow_ups")
    .select("task_id")
    .gt("escalation_level", 0);
  
  const escalatedTaskIds = new Set((existingEscalations || []).map(e => e.task_id));
  const needsEscalation = (overdueTasks || []).filter(t => !escalatedTaskIds.has(t.id));
  
  // Auto-create escalation follow-ups
  for (const task of needsEscalation) {
    const { data: taskData } = await supabase.from("tasks").select("title").eq("id", task.id).single();
    if (taskData) {
      await supabase.from("follow_ups").insert({
        task_id: task.id,
        scheduled_at: new Date().toISOString(),
        escalation_level: 1,
        channel: "app",
        message_draft: `ESCALATED: Task "${taskData.title}" is overdue and needs immediate attention.`,
        status: "scheduled",
      });
    }
  }
  
  return NextResponse.json({
    ok: true,
    mode: "live",
    overdueTasks: overdueTasks?.length || 0,
    alreadyEscalated: escalatedTaskIds.size,
    newlyEscalated: needsEscalation.length,
  });
}

export async function POST(req: NextRequest) {
  const { taskId } = await req.json();
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    const task = state.tasks.find(t => t.id === taskId);
    
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }
    
    // Mark priority as critical and create escalation
    task.priority = "critical";
    
    state.approvals.unshift({
      id: `escalation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      task_id: task.id,
      scheduled_at: new Date().toISOString(),
      sent_at: null,
      escalation_level: 2,
      channel: "app",
      message_draft: `MANUAL ESCALATION: Task "${task.title}" has been manually escalated by the manager.`,
      status: "scheduled",
      created_at: new Date().toISOString(),
    });
    
    writeDemoState(state);
    
    return NextResponse.json({
      ok: true,
      taskId: task.id,
      title: task.title,
      newPriority: task.priority,
    });
  }
  
  // Live mode
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, priority")
    .eq("id", taskId)
    .single();
  
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }
  
  // Mark priority as critical and create escalation
  await supabase.from("tasks").update({ priority: "critical" }).eq("id", taskId);
  
  await supabase.from("follow_ups").insert({
    task_id: taskId,
    scheduled_at: new Date().toISOString(),
    escalation_level: 2,
    channel: "app",
    message_draft: `MANUAL ESCALATION: Task "${task.title}" has been manually escalated by the manager.`,
    status: "scheduled",
  });
  
  return NextResponse.json({
    ok: true,
    mode: "live",
    taskId: task.id,
    title: task.title,
    newPriority: "critical",
  });
}
