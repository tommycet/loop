import { NextRequest, NextResponse } from "next/server";
import { getFlow, saveFlow, deleteFlow } from "@/lib/flows/store";
import { validateFlow } from "@/lib/flows/executor";
import type { Flow } from "@/types/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

// GET /api/flows/[id] — fetch one.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const flow = await getFlow(params.id);
  if (!flow) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ flow });
}

// PUT /api/flows/[id] — full update.
export async function PUT(req: NextRequest, { params }: RouteCtx) {
  const existing = await getFlow(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Flow>;
  const updated: Flow = {
    ...existing,
    ...body,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
  const validation = validateFlow(updated);
  if (!validation.ok) {
    return NextResponse.json({ error: "invalid flow", details: validation.errors }, { status: 400 });
  }
  const saved = await saveFlow(updated);
  return NextResponse.json({ flow: saved });
}

// DELETE /api/flows/[id] — remove.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const ok = await deleteFlow(params.id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}