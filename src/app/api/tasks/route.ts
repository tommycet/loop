import { NextRequest, NextResponse } from "next/server";

import { readDemoState, writeDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    return NextResponse.json(readDemoState().tasks);
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, status, owner_id } = await req.json();

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    state.tasks = state.tasks.map((task) =>
      task.id === id
        ? {
            ...task,
            status: status ?? task.status,
            owner_id: owner_id ?? task.owner_id,
            updated_at: new Date().toISOString(),
          }
        : task,
    );
    writeDemoState(state);
    return NextResponse.json(state.tasks.find((task) => task.id === id) ?? null);
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      owner_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
