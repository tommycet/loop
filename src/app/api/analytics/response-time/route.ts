import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { readDemoState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

// GET /api/analytics/response-time - SLA tracking
// Returns: { overall, byTeam, byContact, trends }
export async function GET(req: NextRequest) {
  const supabase = safeSupabase();

  if (!supabase) {
    const state = readDemoState();
    // Compute response times from demo state
    const completed = (state.tasks as any[]).filter((t) => t.status === "done" && (t.completed_at || t.updated_at));
    const responseTimes: number[] = [];
    for (const t of completed) {
      const created = new Date(t.created_at).getTime();
      const done = new Date(t.completed_at || t.updated_at).getTime();
      if (done > created) responseTimes.push((done - created) / 60000); // minutes
    }
    const avgMin = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    return NextResponse.json({
      ok: true,
      mode: "demo",
      overall: { avgResponseMinutes: Math.round(avgMin), completedCount: responseTimes.length, openCount: state.tasks.filter((t: any) => t.status !== "done").length },
      byTeam: [],
      byContact: [],
    });
  }

  // Live mode
  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("id, status, created_at, updated_at, contact_id, owner_id"),
    supabase.from("team_members").select("id, name, team"),
  ]);

  if (!tasks) return NextResponse.json({ ok: true, mode: "live", overall: null });

  const memberMap: Record<string, any> = {};
  for (const m of members || []) memberMap[m.id] = m;

  // Per-task response time (created → updated for done, or created → now for open)
  const completed: any[] = [];
  const open: any[] = [];
  const now = Date.now();
  for (const t of tasks) {
    const created = new Date(t.created_at).getTime();
    const updated = t.updated_at ? new Date(t.updated_at).getTime() : now;
    const respMin = (updated - created) / 60000;
    const item = { ...t, responseMinutes: Math.round(respMin) };
    if (t.status === "done") completed.push(item);
    else open.push(item);
  }

  // By team
  const byTeamMap: Record<string, { count: number; totalMin: number; open: number }> = {};
  for (const t of [...completed, ...open]) {
    const member = memberMap[t.owner_id];
    if (!member) continue;
    if (!byTeamMap[member.team]) byTeamMap[member.team] = { count: 0, totalMin: 0, open: 0 };
    byTeamMap[member.team].count++;
    byTeamMap[member.team].totalMin += t.responseMinutes;
    if (t.status !== "done") byTeamMap[member.team].open++;
  }
  const byTeam = Object.entries(byTeamMap).map(([team, v]) => ({
    team,
    avgResponseMinutes: Math.round(v.totalMin / v.count),
    taskCount: v.count,
    openCount: v.open,
  }));

  // Overall
  const allRespMin = completed.map((t) => t.responseMinutes);
  const avgMin = allRespMin.length ? allRespMin.reduce((a, b) => a + b, 0) / allRespMin.length : 0;
  const sortedResp = [...allRespMin].sort((a, b) => a - b);
  const p50 = sortedResp[Math.floor(sortedResp.length * 0.5)] || 0;
  const p90 = sortedResp[Math.floor(sortedResp.length * 0.9)] || 0;

  return NextResponse.json({
    ok: true,
    mode: "live",
    overall: {
      avgResponseMinutes: Math.round(avgMin),
      p50ResponseMinutes: p50,
      p90ResponseMinutes: p90,
      completedCount: completed.length,
      openCount: open.length,
    },
    byTeam,
  });
}
