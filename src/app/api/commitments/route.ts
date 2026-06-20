import { NextRequest, NextResponse } from "next/server";

import { readDemoState, writeDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    return NextResponse.json(state.commitments);
  }

  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const id = `cmt-demo-${Date.now()}`;
    const created = {
      id,
      raw_message_id: body.raw_message_id ?? null,
      contact_id: body.contact_id ?? null,
      type: body.type,
      extracted_text: body.extracted_text,
      normalized_obligation: body.normalized_obligation ?? {},
      risk_tier: body.risk_tier ?? "medium",
      status: body.status ?? "detected",
      owner_id: body.owner_id ?? null,
      required_role: body.required_role ?? null,
      due_at: body.due_at ?? null,
      confidence: body.confidence ?? 0.5,
      evidence: body.evidence ?? {},
      source_url: body.source_url ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.commitments = [created, ...state.commitments];
    writeDemoState(state);
    return NextResponse.json(created);
  }

  const { data, error } = await supabase
    .from("commitments")
    .insert({
      raw_message_id: body.raw_message_id ?? null,
      contact_id: body.contact_id ?? null,
      type: body.type,
      extracted_text: body.extracted_text,
      normalized_obligation: body.normalized_obligation ?? {},
      risk_tier: body.risk_tier ?? "medium",
      status: body.status ?? "detected",
      owner_id: body.owner_id ?? null,
      required_role: body.required_role ?? null,
      due_at: body.due_at ?? null,
      confidence: body.confidence ?? 0.5,
      evidence: body.evidence ?? {},
      source_url: body.source_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}