import { NextRequest, NextResponse } from "next/server";

import { readDemoState, writeDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const c = state.commitments.find((x) => x.id === params.id);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const audit = state.auditEvents.filter((e) => e.entity_id === params.id);
    const approvals = state.approvalRequests.filter((a) => a.commitment_id === params.id);
    return NextResponse.json({ commitment: c, audit, approvals });
  }

  const [c, audit, approvals] = await Promise.all([
    supabase.from("commitments").select("*").eq("id", params.id).single(),
    supabase
      .from("audit_events")
      .select("*")
      .eq("entity_type", "commitment")
      .eq("entity_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("approval_requests")
      .select("*")
      .eq("commitment_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (c.error) return NextResponse.json({ error: c.error.message }, { status: 404 });
  return NextResponse.json({
    commitment: c.data,
    audit: audit.data ?? [],
    approvals: approvals.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    state.commitments = state.commitments.map((c) =>
      c.id === params.id ? { ...c, ...body, updated_at: new Date().toISOString() } : c,
    );
    writeDemoState(state);
    return NextResponse.json(state.commitments.find((c) => c.id === params.id) ?? null);
  }
  const { data, error } = await supabase
    .from("commitments")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}