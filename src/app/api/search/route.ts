import { NextRequest, NextResponse } from "next/server";
import { readDemoState } from "../../../lib/demo-state";
import { safeSupabase } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const type = req.nextUrl.searchParams.get("type") || "messages";
  
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const query = q.toLowerCase();
    
    if (type === "messages") {
      const results = state.messages.filter(m => 
        m.content?.toLowerCase().includes(query) ||
        m.channel?.includes(query) ||
        m.status?.includes(query)
      );
      return NextResponse.json({ ok: true, type: "messages", count: results.length, results });
    }
    
    if (type === "tasks") {
      const results = state.tasks.filter(t =>
        t.title?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.priority?.includes(query) ||
        t.status?.includes(query)
      );
      return NextResponse.json({ ok: true, type: "tasks", count: results.length, results });
    }
    
    if (type === "contacts") {
      const results = state.contacts.filter(c =>
        c.name?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.email?.toLowerCase().includes(query)
      );
      return NextResponse.json({ ok: true, type: "contacts", count: results.length, results });
    }
    
    return NextResponse.json({ ok: false, error: "Invalid type. Use: messages, tasks, or contacts" }, { status: 400 });
  }

  // Live mode
  if (type === "messages") {
    const { data, error } = await supabase
      .from("raw_messages")
      .select("*")
      .or(`content.ilike.%${q}%,channel.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, type: "messages", count: data?.length || 0, results: data });
  }
  
  if (type === "tasks") {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, type: "tasks", count: data?.length || 0, results: data });
  }

  return NextResponse.json({ ok: false, error: "Live search for this type not implemented" }, { status: 400 });
}
