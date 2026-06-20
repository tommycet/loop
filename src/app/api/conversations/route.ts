import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { readDemoState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

// GET /api/conversations - List conversations grouped by contact
// Returns: [{ contact, lastMessage, lastMessageAt, openTaskCount, unreadCount, messageCount }]
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const search = url.searchParams.get("search")?.toLowerCase() || "";

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const conversations = state.contacts
      .map((c: any) => {
        const msgs = state.messages.filter((m: any) => m.contact_id === c.id);
        const tasks = state.tasks.filter((t: any) => t.contact_id === c.id && t.status !== "done");
        const last = msgs[0];
        return {
          contact: c,
          lastMessage: last ? { content: last.content, created_at: last.created_at, direction: last.direction } : null,
          lastMessageAt: last?.created_at || c.created_at,
          openTaskCount: tasks.length,
          messageCount: msgs.length,
        };
      })
      .filter((cv: any) => !search || cv.contact.name.toLowerCase().includes(search) || cv.contact.phone.includes(search))
      .sort((a: any, b: any) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .slice(0, limit);
    return NextResponse.json({ ok: true, mode: "demo", count: conversations.length, conversations });
  }

  // Live mode
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone, email, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!contacts) {
    return NextResponse.json({ ok: true, mode: "live", count: 0, conversations: [] });
  }

  const conversations: any[] = [];
  for (const contact of contacts) {
    if (search && !contact.name.toLowerCase().includes(search) && !contact.phone?.includes(search)) continue;

    const [{ data: lastMsg }, { count: msgCount }, { count: openTaskCount }] = await Promise.all([
      supabase
        .from("raw_messages")
        .select("content, created_at, direction, status")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("raw_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contact.id),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contact.id)
        .neq("status", "done"),
    ]);

    conversations.push({
      contact,
      lastMessage: lastMsg,
      lastMessageAt: lastMsg?.created_at || contact.created_at,
      messageCount: msgCount || 0,
      openTaskCount: openTaskCount || 0,
    });
  }

  conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return NextResponse.json({ ok: true, mode: "live", count: Math.min(conversations.length, limit), conversations: conversations.slice(0, limit) });
}
