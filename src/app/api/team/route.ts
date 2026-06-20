import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "../../../lib/runtime";
import { readDemoState } from "../../../lib/demo-state";

export const dynamic = "force-dynamic";

// GET /api/team - List all team members with stats
// POST /api/team - Add a new team member
export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState() as any;
    const team = (state.team_members || [
      { id: "11111111-1111-1111-1111-111111111111", name: "Sarah (Sales)", team: "sales" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Omar (Ops)", team: "operations" },
      { id: "33333333-3333-3333-3333-333333333333", name: "Fatima (Finance)", team: "finance" },
      { id: "44444444-4444-4444-4444-444444444444", name: "Ahmed (Admin)", team: "admin" },
    ]) as any[];

    const enriched = team.map((m: any) => {
      const tasks = state.tasks.filter((t: any) => t.owner_id === m.id);
      return {
        ...m,
        taskCount: tasks.length,
        openCount: tasks.filter((t: any) => t.status !== "done").length,
        doneCount: tasks.filter((t: any) => t.status === "done").length,
      };
    });
    return NextResponse.json({ ok: true, mode: "demo", count: enriched.length, team: enriched });
  }

  const { data: team, error } = await supabase.from("team_members").select("*").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Enrich with task counts
  const { data: tasks } = await supabase.from("tasks").select("owner_id, status");
  const enriched = (team || []).map((m: any) => {
    const myTasks = (tasks || []).filter((t: any) => t.owner_id === m.id);
    return {
      ...m,
      taskCount: myTasks.length,
      openCount: myTasks.filter((t: any) => t.status !== "done").length,
      doneCount: myTasks.filter((t: any) => t.status === "done").length,
    };
  });

  return NextResponse.json({ ok: true, mode: "live", count: enriched.length, team: enriched });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.team) {
    return NextResponse.json({ ok: false, error: "name and team are required" }, { status: 400 });
  }
  const validTeams = ["sales", "operations", "finance", "admin"];
  if (!validTeams.includes(body.team)) {
    return NextResponse.json({ ok: false, error: `team must be one of: ${validTeams.join(", ")}` }, { status: 400 });
  }

  const supabase = safeSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Cannot add team in demo mode" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert({
      name: body.name,
      team: body.team,
      email: body.email || null,
      phone: body.phone || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "live", member: data });
}
