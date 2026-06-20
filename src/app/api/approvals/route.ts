import { NextRequest, NextResponse } from "next/server";

import { readDemoState, writeDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    return NextResponse.json(readDemoState().approvals.filter((approval) => approval.status === "scheduled"));
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    state.approvals = state.approvals.map((approval) =>
      approval.id === id
        ? {
            ...approval,
            status: "pending_approval",
            sent_at: new Date().toISOString(),
          }
        : approval,
    );
    writeDemoState(state);
    return NextResponse.json(state.approvals.find((approval) => approval.id === id) ?? null);
  }

  const { data, error } = await supabase
    .from("follow_ups")
    .update({
      status: "pending_approval",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
