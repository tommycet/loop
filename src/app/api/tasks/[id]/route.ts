import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { readDemoState, writeDemoState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

// GET /api/tasks/[id] - Single task detail
// PATCH /api/tasks/[id] - Update task (status, priority, owner_id, due_at, title, description)
// DELETE /api/tasks/[id] - Delete a task
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const task = state.tasks.find((t: any) => t.id === params.id);
    if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: "demo", task });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*, contact:contacts(id, name, phone, email), owner:team_members(id, name, team)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  return NextResponse.json({ ok: true, mode: "live", task: data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const updates: any = {};

  for (const field of ["status", "priority", "owner_id", "due_at", "title", "description"]) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (body.status === "done") updates.updated_at = new Date().toISOString();

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const idx = state.tasks.findIndex((t: any) => t.id === params.id);
    if (idx < 0) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    state.tasks[idx] = { ...state.tasks[idx], ...updates };
    writeDemoState(state);
    return NextResponse.json({ ok: true, mode: "demo", task: state.tasks[idx] });
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "live", task: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const idx = state.tasks.findIndex((t: any) => t.id === params.id);
    if (idx < 0) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    const [removed] = state.tasks.splice(idx, 1);
    writeDemoState(state);
    return NextResponse.json({ ok: true, mode: "demo", deleted: removed });
  }

  const { error } = await supabase.from("tasks").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "live", deletedId: params.id });
}
