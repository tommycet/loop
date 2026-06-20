import type { ToolCall, ToolName, Team } from "../types";
import { getSupabase } from "./supabase";
import { addHours } from "./utils";
import { safeSupabase } from "./runtime";

export interface ToolContext {
  messageId?: string;
  contactId?: string;
  teamMembers: { id: string; name: string; team: Team }[];
}

export interface ToolResult {
  id?: string;
  success: boolean;
  error?: string;
  decision?: string;
  data?: unknown;
  executed?: boolean;
  escalated?: boolean;
}

async function writeAudit(entityType: string, entityId: string, eventType: string, payload: Record<string, unknown>) {
  const supabase = safeSupabase();
  if (!supabase) return;
  await supabase.from("audit_events").insert({
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    actor_type: "ai",
    payload,
  });
}

const handlers: Record<ToolName, (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>> = {
  async link_to_contact(args) {
    const phone = typeof args.phone === "string" ? args.phone : undefined;
    const email = typeof args.email === "string" ? args.email : undefined;
    const name = typeof args.name === "string" ? args.name : undefined;

    if (phone) {
      const { data, error } = await getSupabase().from("contacts").upsert({ phone, name }, { onConflict: "phone" }).select().single();
      if (error) return { success: false, error: error.message };
      return { success: true, id: data.id };
    }

    if (email) {
      const { data, error } = await getSupabase().from("contacts").upsert({ email, name }, { onConflict: "email" }).select().single();
      if (error) return { success: false, error: error.message };
      return { success: true, id: data.id };
    }

    return { success: false, error: "phone or email required" };
  },

  async create_task(args, ctx) {
    const title = String(args.title ?? "Untitled task");
    const description = typeof args.description === "string" ? args.description : null;
    const priority = (args.priority as string | undefined) ?? "medium";
    const dueInHours = typeof args.due_in_hours === "number" ? args.due_in_hours : 2;

    const { data, error } = await getSupabase()
      .from("tasks")
      .insert({
        raw_message_id: ctx.messageId ?? null,
        contact_id: ctx.contactId ?? null,
        title,
        description,
        priority,
        due_at: addHours(new Date(), dueInHours).toISOString(),
        plan_snapshot: args,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  async assign_owner(args, ctx) {
    const taskId = String(args.task_id ?? "");
    const team = String(args.team ?? "admin") as Team;
    const candidates = ctx.teamMembers.filter((member) => member.team === team);

    if (candidates.length === 0) {
      return { success: false, error: `no team member for ${team}` };
    }

    const counts = await Promise.all(
      candidates.map(async (candidate) => {
        const { count, error } = await getSupabase()
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", candidate.id)
          .neq("status", "done");
        if (error) throw error;
        return { candidate, count: count ?? 0 };
      }),
    );

    const owner = counts.sort((left, right) => left.count - right.count)[0]?.candidate;
    if (!owner) return { success: false, error: "unable to select owner" };

    const { error } = await getSupabase().from("tasks").update({ owner_id: owner.id }).eq("id", taskId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async schedule_followup(args) {
    const taskId = String(args.task_id ?? "");
    const inHours = typeof args.in_hours === "number" ? args.in_hours : 2;
    const escalationLevel = typeof args.escalation_level === "number" ? args.escalation_level : 0;
    const messageDraft = typeof args.message_draft === "string" ? args.message_draft : "";

    const { data, error } = await getSupabase()
      .from("follow_ups")
      .insert({
        task_id: taskId,
        scheduled_at: addHours(new Date(), inHours).toISOString(),
        escalation_level: escalationLevel,
        channel: "app",
        message_draft: messageDraft,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  },

  async draft_message() {
    return { success: true };
  },

  async escalate(args, ctx) {
    return handlers.schedule_followup({ ...args, escalation_level: 1 }, ctx);
  },

  async ignore() {
    return { success: true };
  },

  async ask_human() {
    return { success: true };
  },

  async detect_commitment(args) {
    const type = String(args.type ?? "follow_up");
    const extracted = String(args.extracted_text ?? "");
    const obligation = (args.normalized_obligation ?? {}) as Record<string, unknown>;
    return { success: true, id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, data: { type, extracted, obligation } };
  },

  async create_commitment(args, ctx) {
    const type = String(args.type ?? "follow_up");
    const extracted = String(args.extracted_text ?? "Detected from message");
    const obligation = (args.normalized_obligation ?? {}) as Record<string, unknown>;
    const confidence = typeof args.confidence === "number" ? args.confidence : 0.5;

    const supabase = safeSupabase();
    if (!supabase) {
      return {
        success: true,
        id: `cmt-demo-${Date.now()}`,
        data: { type, extracted, obligation, confidence, ctx },
      };
    }

    const { data, error } = await supabase
      .from("commitments")
      .insert({
        raw_message_id: ctx.messageId ?? null,
        contact_id: ctx.contactId ?? null,
        type,
        extracted_text: extracted,
        normalized_obligation: obligation,
        confidence,
        risk_tier: "medium",
        status: "detected",
        evidence: {},
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id, data };
  },

  async route_approval(args, ctx) {
    const commitmentRef = String(args.commitment_ref ?? args.commitment_id ?? "");
    const requiredRole = String(args.required_role ?? "admin");
    const reason = String(args.reason ?? "needs review");
    const decision = String(args.decision ?? "requires_approval");

    const supabase = safeSupabase();
    if (!supabase) {
      return {
        success: true,
        id: `approval-demo-${Date.now()}`,
        decision,
        data: { commitmentRef, requiredRole, reason, decision, ctx },
      };
    }

    // Create the approval row.
    const { data: approval, error: aErr } = await supabase
      .from("approval_requests")
      .insert({
        commitment_id: commitmentRef,
        required_role: requiredRole,
        decision: "pending",
        proposed_action: { reason },
      })
      .select()
      .single();
    if (aErr) return { success: false, error: aErr.message };

    // Update commitment to needs_approval.
    await supabase
      .from("commitments")
      .update({ status: "needs_approval", required_role: requiredRole })
      .eq("id", commitmentRef);

    // Audit event.
    await supabase.from("audit_events").insert({
      entity_type: "commitment",
      entity_id: commitmentRef,
      event_type: "route_approval",
      actor_type: "ai",
      payload: { required_role: requiredRole, reason, approval_id: approval.id },
    });

    return { success: true, id: approval.id, decision, data: approval };
  },

  async build_evidence_pack(args) {
    const commitmentId = String(args.commitment_ref ?? args.commitment_id ?? "");
    const sourceMessages = (args.source_messages ?? []) as unknown[];
    const transcript = String(args.transcript ?? "");

    const evidence = {
      sourceMessages,
      transcript,
      assembled_at: new Date().toISOString(),
    };

    const supabase = safeSupabase();
    if (!supabase) {
      return { success: true, id: commitmentId, data: evidence };
    }

    await supabase
      .from("commitments")
      .update({ evidence })
      .eq("id", commitmentId);

    await supabase.from("audit_events").insert({
      entity_type: "commitment",
      entity_id: commitmentId,
      event_type: "build_evidence_pack",
      actor_type: "ai",
      payload: { source_count: sourceMessages.length, has_transcript: Boolean(transcript) },
    });

    return { success: true, id: commitmentId, data: evidence };
  },

  async execute_approved_action(args, ctx) {
    const approvalRef = String(args.approval_ref ?? args.approval_id ?? "");
    const supabase = safeSupabase();
    if (!supabase) {
      await writeAudit("commitment", approvalRef, "execute_approved_action", { actor: "ai", mode: "demo", ctx });
      return { success: true, id: approvalRef, executed: true, mode: "demo" };
    }

    const { data: approval, error } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", approvalRef)
      .single();
    if (error || !approval) return { success: false, error: error?.message ?? "approval not found" };
    if (approval.decision === "pending") return { success: false, error: "approval still pending" };

    // Mark commitment executed.
    await supabase
      .from("commitments")
      .update({ status: "executed", updated_at: new Date().toISOString() })
      .eq("id", approval.commitment_id);

    await supabase.from("audit_events").insert({
      entity_type: "commitment",
      entity_id: approval.commitment_id,
      event_type: "execute_approved_action",
      actor_type: "system",
      payload: { approval_id: approvalRef, decision: approval.decision, executed_action: approval.edited_action ?? approval.proposed_action },
    });

    return { success: true, id: approval.commitment_id, executed: true };
  },

  async write_audit_event(args) {
    const entityType = String(args.entity_type ?? "commitment");
    const entityId = String(args.entity_id ?? "");
    const eventType = String(args.event_type ?? "unknown");
    const payload = (args.payload ?? {}) as Record<string, unknown>;
    await writeAudit(entityType, entityId, eventType, payload);
    return { success: true, id: `${entityId}-${Date.now()}` };
  },

  async escalate_stale_commitment(args) {
    const commitmentRef = String(args.commitment_ref ?? args.commitment_id ?? "");
    const hoursStale = Number(args.hours_stale ?? 6);
    const supabase = safeSupabase();
    if (!supabase) {
      return { success: true, id: commitmentRef, escalated: true, mode: "demo", hoursStale };
    }
    await supabase
      .from("commitments")
      .update({ status: "escalated", updated_at: new Date().toISOString() })
      .eq("id", commitmentRef);
    await supabase.from("audit_events").insert({
      entity_type: "commitment",
      entity_id: commitmentRef,
      event_type: "escalate_stale",
      actor_type: "system",
      payload: { hours_stale: hoursStale },
    });
    return { success: true, id: commitmentRef, escalated: true };
  },
};

export async function executeTool(tool: ToolName, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const handler = handlers[tool];
  if (!handler) {
    return { success: false, error: `unknown tool: ${tool}` };
  }
  return handler(args, ctx);
}

export function resolveRefs(call: ToolCall, refs: Map<string, string>): ToolCall {
  const resolvedArgs: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(call.args)) {
    if (key.endsWith("_ref") && typeof value === "string") {
      const uuid = refs.get(value);
      if (!uuid) {
        throw new Error(`Unresolved ref: ${value}`);
      }
      resolvedArgs[key.replace(/_ref$/, "_id")] = uuid;
    } else {
      resolvedArgs[key] = value;
    }
  }

  return {
    ...call,
    args: resolvedArgs,
  };
}
