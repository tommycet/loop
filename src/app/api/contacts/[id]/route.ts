import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { readDemoState, writeDemoState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

// GET /api/contacts/[id] - Single contact with full message history
// PATCH /api/contacts/[id] - Update contact (name, email, metadata)
// DELETE /api/contacts/[id] - Delete contact
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const contact = state.contacts.find((c: any) => c.id === params.id);
    if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    const messages = state.messages.filter((m: any) => m.contact_id === params.id);
    const tasks = state.tasks.filter((t: any) => t.contact_id === params.id);
    return NextResponse.json({ ok: true, mode: "demo", contact, messages, tasks });
  }

  const [{ data: contact, error: cErr }, { data: messages }, { data: tasks }] = await Promise.all([
    supabase.from("contacts").select().eq("id", params.id).maybeSingle(),
    supabase.from("raw_messages").select("id, content, channel, direction, status, created_at").eq("contact_id", params.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("tasks").select("id, title, status, priority, due_at, created_at, owner_id").eq("contact_id", params.id).order("created_at", { ascending: false }).limit(50),
  ]);

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
  if (!contact) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });

  return NextResponse.json({ ok: true, mode: "live", contact, messages: messages || [], tasks: tasks || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const updates: any = {};
  for (const field of ["name", "email"]) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (body.metadata) updates.metadata = body.metadata;

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const idx = state.contacts.findIndex((c: any) => c.id === params.id);
    if (idx < 0) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    state.contacts[idx] = { ...state.contacts[idx], ...updates };
    writeDemoState(state);
    return NextResponse.json({ ok: true, mode: "demo", contact: state.contacts[idx] });
  }

  const { data, error } = await supabase.from("contacts").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "live", contact: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const idx = state.contacts.findIndex((c: any) => c.id === params.id);
    if (idx < 0) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    const [removed] = state.contacts.splice(idx, 1);
    writeDemoState(state);
    return NextResponse.json({ ok: true, mode: "demo", deleted: removed });
  }

  // Cascade: delete messages, tasks, follow_ups first
  await supabase.from("raw_messages").delete().eq("contact_id", params.id);
  const { data: tasks } = await supabase.from("tasks").select("id").eq("contact_id", params.id);
  if (tasks && tasks.length) {
    const taskIds = tasks.map((t: any) => t.id);
    await supabase.from("follow_ups").delete().in("task_id", taskIds);
    await supabase.from("tasks").delete().eq("contact_id", params.id);
  }
  const { error } = await supabase.from("contacts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "live", deletedId: params.id });
}
