import { NextResponse } from "next/server";
import { readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    const now = Date.now();
    
    const messagesByChannel = state.messages.reduce((acc, m) => {
      acc[m.channel] = (acc[m.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const messagesByStatus = state.messages.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const tasksByStatus = state.tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const tasksByPriority = state.tasks.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const tasksByTeam = state.tasks.reduce((acc, t) => {
      const ownerId = t.owner_id;
      if (ownerId?.startsWith("11111111")) acc.sales = (acc.sales || 0) + 1;
      else if (ownerId?.startsWith("22222222")) acc.operations = (acc.operations || 0) + 1;
      else if (ownerId?.startsWith("33333333")) acc.finance = (acc.finance || 0) + 1;
      else if (ownerId?.startsWith("44444444")) acc.admin = (acc.admin || 0) + 1;
      else acc.unassigned = (acc.unassigned || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const overdueTasks = state.tasks.filter(t => 
      t.due_at && new Date(t.due_at).getTime() < now && t.status !== "done"
    ).length;
    
    return NextResponse.json({
      ok: true,
      mode: "demo",
      totalMessages: state.messages.length,
      totalTasks: state.tasks.length,
      totalContacts: state.contacts.length,
      totalApprovals: state.approvals.length,
      overdueTasks,
      messagesByChannel,
      messagesByStatus,
      tasksByStatus,
      tasksByPriority,
      tasksByTeam,
    });
  }
  
  // Live mode
  const [{ count: totalMessages }, { count: totalTasks }, { count: totalContacts }, { count: overdue }] = await Promise.all([
    supabase.from("raw_messages").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).lt("due_at", new Date().toISOString()).neq("status", "done"),
  ]);
  
  return NextResponse.json({
    ok: true,
    mode: "live",
    totalMessages: totalMessages || 0,
    totalTasks: totalTasks || 0,
    totalContacts: totalContacts || 0,
    overdueTasks: overdue || 0,
  });
}
