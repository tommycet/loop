import { NextResponse } from "next/server";

import { readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    return NextResponse.json(state.auditEvents.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)));
  }
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}