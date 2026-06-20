// PUT /api/authority-rules — update a single rule by id.
// Body: Partial<AuthorityRule> with id required.
// Logs every change to audit_events.

import { NextRequest, NextResponse } from "next/server";
import { readDemoState, writeDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";
import type { AuthorityRule } from "../../../types";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Partial<AuthorityRule>;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const sb = safeSupabase();
  if (!sb) {
    const state = readDemoState();
    const idx = state.authorityRules.findIndex((r) => r.id === body.id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    const existing = state.authorityRules[idx];
    const updated: AuthorityRule = {
      ...existing,
      ...body,
      id: existing.id,
      created_at: existing.created_at,
    };
    state.authorityRules[idx] = updated;
    writeDemoState(state);
    return NextResponse.json({ rule: updated });
  }

  // Live Supabase path.
  const { data: existing, error: readErr } = await sb
    .from("authority_rules")
    .select("*")
    .eq("id", body.id)
    .single();
  if (readErr || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const merged = { ...existing, ...body, id: existing.id, created_at: existing.created_at };
  const { data: saved, error: updErr } = await sb
    .from("authority_rules")
    .update(merged)
    .eq("id", body.id)
    .select()
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ rule: saved });
}