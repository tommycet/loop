import { NextRequest, NextResponse } from "next/server";

import {
  type ProcessableMessage,
  type ProcessResult,
  detectAndCreateCommitment,
} from "@/lib/channels/process-message";
import { readDemoState, writeDemoState } from "@/lib/demo-state";
import { safeSupabase } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * POST /api/detect-commitments/[messageId]
 *
 * Run the real-time detection pipeline on a single stored message. This
 * is the "inline" path — used by the Telegram webhook for instant
 * feedback in the demo, and exposed as a manual operator action for
 * reprocessing messages that the Inngest batch skipped.
 *
 * Demo mode: reads from .demo-state/, persists to it.
 * Supabase mode: reads from `raw_messages`, writes to `commitments`,
 * `approval_requests`, and `audit_events`.
 *
 * Returns:
 *   200 — { status: "created", commitment, approval, audit } or
 *          { status: "skipped", reason }
 *   404 — message not found
 *   500 — persistence failure
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { messageId: string } },
) {
  const supabase = safeSupabase();
  if (!supabase) {
    return handleDemoMode(params.messageId);
  }
  return handleSupabaseMode(supabase, params.messageId);
}

// ─── Demo state path ─────────────────────────────────────────────────────

function handleDemoMode(messageId: string): NextResponse {
  const state = readDemoState();
  const msg = state.messages.find((m) => m.id === messageId);
  if (!msg) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }

  const processable: ProcessableMessage = {
    id: msg.id,
    channel: msg.channel,
    contactName: null,
    content: msg.content ?? null,
    createdAt: msg.created_at,
    flaggedAsNoise: msg.status === "noise",
  };

  const result = detectAndCreateCommitment(processable);
  if (result.action === "skipped") {
    return NextResponse.json({ status: "skipped", reason: result.reason });
  }

  // Persist to demo state.
  state.commitments = state.commitments.filter((c) => c.id !== result.commitment.id);
  state.commitments.unshift(result.commitment);

  if (result.approval) {
    state.approvalRequests = state.approvalRequests.filter(
      (a) => a.id !== result.approval!.id,
    );
    state.approvalRequests.unshift(result.approval);
  }

  state.auditEvents = [
    {
      id: `audit-${Date.now()}`,
      entity_type: "commitment" as const,
      entity_id: result.commitment.id,
      event_type: result.audit.event_type,
      actor_type: "ai" as const,
      payload: result.audit.payload as Record<string, unknown>,
      created_at: new Date().toISOString(),
    },
    ...state.auditEvents,
  ];

  // Mark the message as extracted so the dashboard reflects the new state.
  const target = state.messages.find((m) => m.id === messageId);
  if (target) target.status = "extracted";

  writeDemoState(state);

  return NextResponse.json({
    status: "created",
    commitment: result.commitment,
    approval: result.approval,
    audit: result.audit,
  });
}

// ─── Supabase path ───────────────────────────────────────────────────────

function handleSupabaseMode(
  supabase: ReturnType<typeof safeSupabase> & object,
  messageId: string,
): Promise<NextResponse> {
  return (async () => {
    const { data: msg, error } = await supabase
      .from("raw_messages")
      .select("id, channel, content, status, contact_id")
      .eq("id", messageId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!msg) {
      return NextResponse.json({ error: "message not found" }, { status: 404 });
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("name")
      .eq("id", msg.contact_id ?? "")
      .maybeSingle();

    const processable: ProcessableMessage = {
      id: msg.id,
      channel: msg.channel,
      contactName: contact?.name ?? null,
      content: msg.content ?? null,
      createdAt: new Date().toISOString(),
      flaggedAsNoise: msg.status === "noise",
    };

    const result: ProcessResult = detectAndCreateCommitment(processable);
    if (result.action === "skipped") {
      return NextResponse.json({ status: "skipped", reason: result.reason });
    }

    const { error: cErr } = await supabase
      .from("commitments")
      .upsert(
        {
          id: result.commitment.id,
          contact_id: result.commitment.contact_id,
          raw_message_id: result.commitment.raw_message_id,
          // channel comes from the source message, not the commitment row
          type: result.commitment.type,
          extracted_text: result.commitment.extracted_text,
          risk_tier: result.commitment.risk_tier,
          normalized_obligation: result.commitment.normalized_obligation,
          evidence: result.commitment.evidence,
          required_role: result.commitment.required_role,
          status: result.commitment.status,
        },
        { onConflict: "id" },
      );

    if (cErr) {
      return NextResponse.json(
        { error: `commitment upsert failed: ${cErr.message}` },
        { status: 500 },
      );
    }

    if (result.approval) {
      await supabase.from("approval_requests").upsert(
        {
          id: result.approval.id,
          commitment_id: result.approval.commitment_id,
          required_role: result.approval.required_role,
          proposed_action: result.approval.proposed_action,
          decision: result.approval.decision,
        },
        { onConflict: "id" },
      );
    }

    await supabase.from("audit_events").insert({
      entity_type: "commitment",
      entity_id: result.commitment.id,
      event_type: result.audit.event_type,
      actor_type: result.audit.actor_type,
      payload: result.audit.payload as Record<string, unknown>,
    });

    await supabase
      .from("raw_messages")
      .update({ status: "extracted" })
      .eq("id", messageId);

    return NextResponse.json({
      status: "created",
      commitment: result.commitment,
      approval: result.approval,
      audit: result.audit,
    });
  })();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { messageId: string } },
) {
  // Read-only: show what's already been detected for this message.
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState();
    const c = state.commitments.find((c) => c.raw_message_id === params.messageId);
    if (!c) {
      return NextResponse.json({ status: "none" }, { status: 200 });
    }
    return NextResponse.json({ status: "detected", commitment: c });
  }
  const { data } = await supabase
    .from("commitments")
    .select("*")
    .eq("raw_message_id", params.messageId)
    .maybeSingle();
  if (!data) return NextResponse.json({ status: "none" });
  return NextResponse.json({ status: "detected", commitment: data });
}