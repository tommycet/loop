import { NextRequest, NextResponse } from "next/server";
import { listFlowsAsync, saveFlow } from "@/lib/flows/store";
import { buildFlow, validateFlow } from "@/lib/flows/executor";
import type { Flow } from "@/types/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/flows — list all flows.
export async function GET() {
  const flows = await listFlowsAsync();
  return NextResponse.json({ flows });
}

// POST /api/flows — create or update. Body: Partial<Flow>.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Flow>;
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const flow: Flow = buildFlow({
    name: body.name,
    description: body.description,
    enabled: body.enabled ?? true,
    nodes: (body.nodes || []).map((n) => ({ ...n, position: n.position ?? { x: 0, y: 0 } })),
    edges: body.edges || [],
  });
  // Preserve client-provided id if present (for updates).
  if (body.id) flow.id = body.id;
  if (body.created_at) flow.created_at = body.created_at;
  flow.updated_at = now;

  const validation = validateFlow(flow);
  if (!validation.ok) {
    return NextResponse.json({ error: "invalid flow", details: validation.errors }, { status: 400 });
  }
  const saved = await saveFlow(flow);
  return NextResponse.json({ flow: saved }, { status: 201 });
}