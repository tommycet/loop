// GET /api/commitments/[id]/evidence?format=html|csv
// Returns the evidence pack for a single commitment.
// format=html (default): self-contained HTML report (print-to-PDF).
// format=csv: audit log as CSV.

import { NextRequest, NextResponse } from "next/server";
import { readDemoState } from "../../../../../lib/demo-state";
import { safeSupabase } from "../../../../../lib/runtime";
import {
  buildEvidencePack,
  renderEvidenceHTML,
  toCSV,
  type EvidenceInput,
} from "../../../../../lib/evidence";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "html";

  const sb = safeSupabase();

  let input: EvidenceInput | null = null;

  if (!sb) {
    const state = readDemoState();
    const c = state.commitments.find((x) => x.id === params.id);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const audit = state.auditEvents.filter((e) => e.entity_id === params.id);
    const approvals = state.approvalRequests.filter((a) => a.commitment_id === params.id);
    const sourceMsg = c.raw_message_id
      ? state.messages.find((m) => m.id === c.raw_message_id)
      : null;
    input = {
      commitment: {
        id: c.id,
        type: c.type,
        extracted_text: c.extracted_text,
        risk_tier: c.risk_tier,
        status: c.status,
        confidence: c.confidence,
        required_role: c.required_role,
        created_at: c.created_at,
      },
      source_message: sourceMsg
        ? {
            id: sourceMsg.id,
            channel: sourceMsg.channel,
            content: sourceMsg.content ?? "",
            external_id: sourceMsg.external_id,
            contact_id: sourceMsg.contact_id ?? undefined,
            created_at: sourceMsg.created_at,
          }
        : null,
      approvals: approvals.map((a) => ({
        id: a.id,
        required_role: a.required_role,
        decision: a.decision,
        decision_reason: a.decision_reason,
        decided_at: a.decided_at,
        decided_by_role: a.decided_by_role,
        created_at: a.created_at,
      })),
      audit_events: audit.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        actor_type: e.actor_type,
        actor_id: e.actor_id,
        created_at: e.created_at,
        payload: e.payload as Record<string, unknown>,
      })),
    };
  } else {
    const [{ data: c }, { data: audit }, { data: approvals }] = await Promise.all([
      sb.from("commitments").select("*").eq("id", params.id).single(),
      sb.from("audit_events").select("*").eq("entity_id", params.id).order("created_at", { ascending: true }),
      sb.from("approval_requests").select("*").eq("commitment_id", params.id),
    ]);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    let sourceMsg: EvidenceInput["source_message"] = null;
    if (c.raw_message_id) {
      const { data: m } = await sb.from("raw_messages").select("*").eq("id", c.raw_message_id).maybeSingle();
      if (m) {
        sourceMsg = {
          id: m.id,
          channel: m.channel,
          content: m.content,
          external_id: m.external_id,
          contact_id: m.contact_id,
          created_at: m.created_at,
        };
      }
    }
    input = {
      commitment: {
        id: c.id,
        type: c.type,
        extracted_text: c.extracted_text,
        risk_tier: c.risk_tier,
        status: c.status,
        confidence: c.confidence,
        required_role: c.required_role,
        created_at: c.created_at,
      },
      source_message: sourceMsg,
      approvals: (approvals || []).map((a) => ({
        id: a.id,
        required_role: a.required_role,
        decision: a.decision,
        decision_reason: a.decision_reason,
        decided_at: a.decided_at,
        decided_by_role: a.decided_by_role,
        created_at: a.created_at,
      })),
      audit_events: (audit || []).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        actor_type: e.actor_type,
        actor_id: e.actor_id,
        created_at: e.created_at,
        payload: (e.payload as Record<string, unknown>) || {},
      })),
    };
  }

  if (!input) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pack = buildEvidencePack(input);

  if (format === "csv") {
    const csv = toCSV(pack.audit_events);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="evidence-${params.id}.csv"`,
      },
    });
  }

  const html = renderEvidenceHTML(pack);
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="evidence-${params.id}.html"`,
    },
  });
}