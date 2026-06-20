import { NextResponse } from "next/server";

import { readDemoState } from "../../../../lib/demo-state";
import { hasSupabaseEnv, safeSupabase } from "../../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();

  if (!supabase) {
    const state = readDemoState();
    return NextResponse.json({
      mode: "demo",
      stateSummary: {
        messages: state.messages.length,
        tasks: state.tasks.length,
        approvals: state.approvals.length,
      },
      sample: {
        message: state.messages[0] ?? null,
        task: state.tasks[0] ?? null,
        approval: state.approvals[0] ?? null,
      },
    });
  }

  const [{ count: messages }, { count: tasks }, { count: approvals }] = await Promise.all([
    supabase.from("raw_messages").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("follow_ups").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    mode: hasSupabaseEnv() ? "live" : "demo",
    stateSummary: {
      messages: messages ?? 0,
      tasks: tasks ?? 0,
      approvals: approvals ?? 0,
    },
  });
}
