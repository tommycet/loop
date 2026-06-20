import { NextResponse } from "next/server";
import { readDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";

export const dynamic = "force-dynamic";

const TEAM_MEMBERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sarah (Sales)", team: "sales" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Omar (Ops)", team: "operations" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Fatima (Finance)", team: "finance" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Ahmed (Admin)", team: "admin" },
];

export async function GET() {
  const supabase = safeSupabase();
  
  if (!supabase) {
    const state = readDemoState();
    const now = Date.now();
    const openTasks = state.tasks.filter(t => t.status !== "done");
    
    const workload = TEAM_MEMBERS.map(member => {
      const memberTasks = openTasks.filter(t => t.owner_id === member.id);
      const completed = state.tasks.filter(t => t.owner_id === member.id && t.status === "done");
      return {
        id: member.id,
        name: member.name,
        team: member.team,
        openTasks: memberTasks.length,
        completedTasks: completed.length,
        overdueTasks: memberTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now).length,
        highPriority: memberTasks.filter(t => t.priority === "high" || t.priority === "critical").length,
        tasks: memberTasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          due_at: t.due_at,
          overdue: t.due_at ? new Date(t.due_at).getTime() < now : false,
        })),
      };
    });
    
    const unassigned = openTasks.filter(t => !t.owner_id);
    
    return NextResponse.json({
      ok: true,
      mode: "demo",
      team: workload,
      unassigned: {
        count: unassigned.length,
        tasks: unassigned.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
      },
    });
  }
  
  // Live mode
  const [{ data: openTasks }, { data: allTasks }, { data: teamMembers }] = await Promise.all([
    supabase.from("tasks").select("id, title, priority, status, due_at, owner_id").neq("status", "done"),
    supabase.from("tasks").select("owner_id, status").eq("status", "done"),
    supabase.from("team_members").select("id, name, team"),
  ]);
  
  const now = Date.now();
  
  const workload = (teamMembers || []).map(member => {
    const memberTasks = (openTasks || []).filter(t => t.owner_id === member.id);
    const completed = (allTasks || []).filter(t => t.owner_id === member.id);
    return {
      id: member.id,
      name: member.name,
      team: member.team,
      openTasks: memberTasks.length,
      completedTasks: completed.length,
      overdueTasks: memberTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now).length,
      highPriority: memberTasks.filter(t => t.priority === "high" || t.priority === "critical").length,
      tasks: memberTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, status: t.status, due_at: t.due_at,
        overdue: t.due_at ? new Date(t.due_at).getTime() < now : false,
      })),
    };
  });
  
  const unassigned = (openTasks || []).filter(t => !t.owner_id);
  
  return NextResponse.json({
    ok: true,
    mode: "live",
    team: workload,
    unassigned: {
      count: unassigned.length,
      tasks: unassigned.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
    },
  });
}
