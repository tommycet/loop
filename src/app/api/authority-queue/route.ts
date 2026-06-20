import { NextResponse } from "next/server";

import { readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const pending = state.approvalRequests.filter((a) => a.decision === "pending");
    const enriched = pending.map((approval) => {
      const commitment = state.commitments.find((c) => c.id === approval.commitment_id);
      return { approval, commitment };
    });
    return NextResponse.json(enriched);
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .select("*, commitments(*)")
    .eq("decision", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).map((row) => ({
    approval: {
      id: row.id,
      commitment_id: row.commitment_id,
      required_role: row.required_role,
      approver_id: row.approver_id,
      proposed_action: row.proposed_action,
      edited_action: row.edited_action,
      decision: row.decision,
      decision_reason: row.decision_reason,
      decided_at: row.decided_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
    },
    commitment: row.commitments,
  }));
  return NextResponse.json(rows);
}