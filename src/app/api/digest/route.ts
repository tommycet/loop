import { NextResponse } from "next/server";
import { readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";
import { getGroq } from "../../../lib/groq";

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
    const overdueTasks = openTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now);
    const pendingApprovals = state.approvals.filter(a => a.status === "scheduled");
    const newMessages = state.messages.filter(m => m.status === "pending" || m.status === "extracted");
    
    // Team workload
    const workload = TEAM_MEMBERS.map(member => {
      const memberTasks = openTasks.filter(t => t.owner_id === member.id);
      return {
        name: member.name,
        team: member.team,
        totalTasks: memberTasks.length,
        overdueTasks: memberTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now).length,
        highPriority: memberTasks.filter(t => t.priority === "high" || t.priority === "critical").length,
      };
    });
    
    // Generate AI summary
    let aiSummary = null;
    let aiError = null;
    try {
      const prompt = `You are Loop, an AI ops agent. Generate a concise daily operations digest for the manager.

Data:
- Total open tasks: ${openTasks.length}
- Overdue tasks: ${overdueTasks.length}
- Pending approvals: ${pendingApprovals.length}
- New messages today: ${newMessages.length}

Overdue tasks:
${overdueTasks.map(t => `- [${t.priority}] ${t.title}`).join("\n") || "None"}

Team workload:
${workload.map(w => `- ${w.name}: ${w.totalTasks} tasks (${w.overdueTasks} overdue, ${w.highPriority} high priority)`).join("\n")}

Pending approvals:
${pendingApprovals.map(a => `- [${a.channel}] ${a.message_draft?.substring(0, 80)}...`).join("\n") || "None"}

Generate a 3-4 sentence summary highlighting what needs attention today. Be direct and specific.`;

      const response = await getGroq().chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });
      aiSummary = response.choices[0]?.message?.content || null;
    } catch (e: any) {
      aiError = e.message;
    }
    
    return NextResponse.json({
      ok: true,
      mode: "demo",
      date: new Date().toISOString().split("T")[0],
      summary: {
        totalOpenTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        pendingApprovals: pendingApprovals.length,
        newMessages: newMessages.length,
      },
      overdueTasks: overdueTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due_at: t.due_at,
        owner: TEAM_MEMBERS.find(m => m.id === t.owner_id)?.name || "Unassigned",
      })),
      workload,
      pendingApprovals: pendingApprovals.map(a => ({
        id: a.id,
        channel: a.channel,
        message_draft: a.message_draft?.substring(0, 100),
      })),
      aiSummary,
      aiError,
    });
  }
  
  // Live mode
  const [{ data: openTasks }, { count: overdueCount }, { data: pendingFollowUps }, { data: teamMembers }, { count: messageCount }] = await Promise.all([
    supabase.from("tasks").select("id, title, priority, due_at, owner_id").neq("status", "done").order("due_at", { ascending: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).lt("due_at", new Date().toISOString()).neq("status", "done"),
    supabase.from("follow_ups").select("id, channel, message_draft").eq("status", "scheduled").limit(10),
    supabase.from("team_members").select("id, name, team"),
    supabase.from("raw_messages").select("*", { count: "exact", head: true }),
  ]);
  
  const now = Date.now();
  const overdueTasks = (openTasks || []).filter(t => t.due_at && new Date(t.due_at).getTime() < now);
  
  const workload = (teamMembers || []).map(member => {
    const memberTasks = (openTasks || []).filter(t => t.owner_id === member.id);
    return {
      name: member.name,
      team: member.team,
      totalTasks: memberTasks.length,
      overdueTasks: memberTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now).length,
      highPriority: memberTasks.filter(t => t.priority === "high" || t.priority === "critical").length,
    };
  });
  
  let aiSummary = null;
  try {
    const prompt = `You are Loop, an AI ops agent. Generate a concise daily operations digest.

Data:
- Total open tasks: ${openTasks?.length || 0}
- Overdue tasks: ${overdueCount || 0}
- Pending approvals: ${pendingFollowUps?.length || 0}
- New messages: ${messageCount || 0}

Overdue tasks:
${overdueTasks.map(t => `- [${t.priority}] ${t.title}`).join("\\n") || "None"}

Generate a 2-3 sentence summary highlighting what needs attention today.`;

    const response = await getGroq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });
    aiSummary = response.choices[0]?.message?.content || null;
  } catch (e) { /* AI summary is optional */ }
  
  return NextResponse.json({
    ok: true,
    mode: "live",
    date: new Date().toISOString().split("T")[0],
    summary: {
      totalOpenTasks: openTasks?.length || 0,
      overdueTasks: overdueCount || 0,
      pendingApprovals: pendingFollowUps?.length || 0,
      newMessages: messageCount || 0,
    },
    overdueTasks: overdueTasks.map(t => ({
      id: t.id, title: t.title, priority: t.priority, due_at: t.due_at,
      owner: (teamMembers || []).find(m => m.id === t.owner_id)?.name || "Unassigned",
    })),
    workload,
    pendingApprovals: pendingFollowUps || [],
    aiSummary,
  });
}
