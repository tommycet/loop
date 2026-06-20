import { NextResponse } from "next/server";

import { getDemoDashboard, readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    return NextResponse.json({
      ...getDemoDashboard(state),
      managersNote: "Demo data active — local file-backed state is persisting changes.",
      handledToday: state.messages.length,
      criticalPressure: state.tasks.filter((task) => task.priority === "critical").length,
    });
  }

  const [
    { count: messages },
    { count: openTasks },
    { count: approvals },
    { count: overdue },
    { count: openCommitments },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("raw_messages").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("follow_ups").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).lt("due_at", new Date().toISOString()).neq("status", "done"),
    supabase
      .from("commitments")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(closed,executed)"),
    supabase.from("approval_requests").select("*", { count: "exact", head: true }).eq("decision", "pending"),
  ]);

  return NextResponse.json({
    messages: messages ?? 0,
    openTasks: openTasks ?? 0,
    approvals: approvals ?? 0,
    overdue: overdue ?? 0,
    openCommitments: openCommitments ?? 0,
    pendingApprovals: pendingApprovals ?? 0,
  });
}
