import { NextRequest, NextResponse } from "next/server";
import { listFlowsAsync } from "@/lib/flows/store";
import { evaluateFlow } from "@/lib/flows/executor";
import type { FlowEvent } from "@/types/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/flows/run — evaluate all enabled flows against an event.
// Body: { event: FlowEvent, flow_id?: string }
// If flow_id is provided, runs only that flow. Otherwise runs all enabled flows.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { event?: FlowEvent; flow_id?: string };
  if (!body.event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }
  const allFlows = await listFlowsAsync();
  const targetFlows = body.flow_id
    ? allFlows.filter((f) => f.id === body.flow_id)
    : allFlows.filter((f) => f.enabled);

  const results = targetFlows.map((f) => evaluateFlow(f, body.event!));
  const matched = results.filter((r) => r.matched);
  return NextResponse.json({
    evaluated: results.length,
    matched: matched.length,
    results,
  });
}