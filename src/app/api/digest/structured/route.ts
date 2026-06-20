// GET /api/digest/structured — returns the structured daily digest built
// from live state. No AI call, no LLM cost. Returns both the JSON shape
// (for dashboards) and a formatted plain-text message (for Telegram/WhatsApp).

import { NextResponse } from "next/server";
import { readDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import { buildDigest, formatDigestForTelegram, type DigestInput } from "../../../../lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadDemoDigest(): Promise<DigestInput> {
  const s = readDemoState();
  return {
    commitments: s.commitments.map((c) => ({
      id: c.id,
      summary: c.extracted_text,
      commitment_type: c.type,
      created_at: c.created_at,
      status: c.status,
      risk_tier: c.risk_tier,
    })),
    approvalRequests: (s.approvalRequests || []).map((a) => ({
      id: a.id,
      commitment_summary: a.proposed_action?.summary as string | undefined,
      commitment_id: a.commitment_id,
      required_role: a.required_role,
      status: a.decision === "pending" ? "pending" : "resolved",
      escalated: a.decision === "rejected",
    })),
    tasks: s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      updated_at: t.updated_at,
    })),
  };
}

async function loadLiveDigest(supabase: NonNullable<ReturnType<typeof safeSupabase>>): Promise<DigestInput> {
  const [{ data: commits }, { data: approvals }, { data: tasks }] = await Promise.all([
    supabase.from("commitments").select("id, extracted_text, type, status, risk_tier, created_at"),
    supabase.from("approval_requests").select("id, commitment_id, required_role, decision, proposed_action, decided_by_role"),
    supabase.from("tasks").select("id, title, status, updated_at"),
  ]);
  return {
    commitments: (commits || []).map((c) => ({
      id: c.id,
      summary: c.extracted_text,
      commitment_type: c.type,
      created_at: c.created_at,
      status: c.status,
      risk_tier: c.risk_tier,
    })),
    approvalRequests: (approvals || []).map((a) => ({
      id: a.id,
      commitment_summary: (a.proposed_action as Record<string, unknown>)?.summary as string | undefined,
      commitment_id: a.commitment_id,
      required_role: a.required_role,
      status: a.decision === "pending" ? "pending" : "resolved",
      escalated: (a.decided_by_role as string) === "escalated",
    })),
    tasks: (tasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      updated_at: t.updated_at,
    })),
  };
}

export async function GET() {
  const sb = safeSupabase();
  try {
    const input = sb ? await loadLiveDigest(sb) : await loadDemoDigest();
    const digest = buildDigest(input);
    const message = formatDigestForTelegram(digest);
    return NextResponse.json({
      ok: true,
      mode: sb ? "live" : "demo",
      digest,
      message,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}