import { NextRequest, NextResponse } from "next/server";

import { currentRoleFromCookies, type Role } from "../../../../../lib/auth-server";
import { readDemoState, writeDemoState } from "../../../../../lib/demo-state";
import { safeSupabase } from "../../../../../lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Server-side authorization rule for the decide endpoint.
 *
 * - viewer:   can never approve (read-only role)
 * - admin:    can approve anything (override authority)
 * - any other role (sales / operations / finance): may approve only if
 *   approval.required_role matches their role
 *
 * Returns null when allowed, or a NextResponse when denied.
 */
function authorize(role: Role | null, requiredRole: string | null | undefined): NextResponse | null {
  if (!role) {
    return NextResponse.json(
      { error: "unauthenticated", message: "Sign in to decide approvals." },
      { status: 401 },
    );
  }
  if (role === "viewer") {
    return NextResponse.json(
      { error: "forbidden", message: "Viewer role is read-only and cannot decide approvals." },
      { status: 403 },
    );
  }
  if (role === "admin") return null; // admin overrides
  if (requiredRole && role !== requiredRole) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: `This approval requires the '${requiredRole}' role. You are signed in as '${role}'.`,
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Stable per-role actor ID so audit events identify the human who acted,
 * not a generic placeholder.
 */
function actorIdForRole(role: Role): string {
  return `human-${role}-0000-0000-0000-000000000000`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const decision = String(body.decision ?? "approved");
  const editedAction = (body.edited_action ?? null) as Record<string, unknown> | null;
  const reason = body.decision_reason ? String(body.decision_reason) : null;

  // Read role from cookie BEFORE doing any work
  const role = currentRoleFromCookies();

  const supabase = safeSupabase();
  if (!supabase) {
    // --- demo state branch ---
    const state = readDemoState();
    const target = state.approvalRequests.find((a) => a.id === params.id);
    if (!target) {
      return NextResponse.json({ error: "approval not found" }, { status: 404 });
    }
    const denial = authorize(role, target.required_role);
    if (denial) return denial;

    const actor = actorIdForRole(role!);

    state.approvalRequests = state.approvalRequests.map((a) =>
      a.id === params.id
        ? {
            ...a,
            decision: decision as "pending" | "approved" | "edited" | "rejected" | "expired",
            edited_action: editedAction,
            decision_reason: reason,
            decided_at: new Date().toISOString(),
            decided_by_role: role,
            approver_id: actor,
          }
        : a,
    );
    state.commitments = state.commitments.map((c) =>
      c.id === state.approvalRequests.find((a) => a.id === params.id)?.commitment_id
        ? {
            ...c,
            status:
              decision === "approved" || decision === "edited"
                ? "approved"
                : decision === "rejected"
                  ? "rejected"
                  : c.status,
            updated_at: new Date().toISOString(),
          }
        : c,
    );
    state.auditEvents = [
      ...state.auditEvents,
      {
        id: `audit-${Date.now()}`,
        entity_type: "approval" as const,
        entity_id: params.id,
        event_type: `approval_${decision}`,
        actor_type: "human" as const,
        actor_id: actor,
        actor_role: role,
        payload: { reason, edited_action: editedAction, role },
        created_at: new Date().toISOString(),
      },
    ];
    writeDemoState(state);
    return NextResponse.json({ ok: true, actor_role: role });
  }

  // --- Supabase branch ---
  const { data: approval, error: fetchErr } = await supabase
    .from("approval_requests")
    .select("required_role, commitment_id")
    .eq("id", params.id)
    .single();

  if (fetchErr || !approval) {
    return NextResponse.json({ error: fetchErr?.message ?? "approval not found" }, { status: 404 });
  }

  const denial = authorize(role, approval.required_role);
  if (denial) return denial;

  const actor = actorIdForRole(role!);

  const { data: updated, error: updateErr } = await supabase
    .from("approval_requests")
    .update({
      decision,
      edited_action: editedAction,
      decision_reason: reason,
      decided_at: new Date().toISOString(),
      decided_by_role: role,
      approver_id: actor,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await supabase
    .from("commitments")
    .update({
      status:
        decision === "approved" || decision === "edited"
          ? "approved"
          : decision === "rejected"
            ? "rejected"
            : "needs_approval",
      updated_at: new Date().toISOString(),
    })
    .eq("id", updated.commitment_id);

  await supabase.from("audit_events").insert({
    entity_type: "approval",
    entity_id: params.id,
    event_type: `approval_${decision}`,
    actor_type: "human",
    actor_id: actor,
    actor_role: role,
    payload: {
      reason,
      edited_action: editedAction,
      commitment_id: updated.commitment_id,
      role,
    },
  });

  return NextResponse.json({ ok: true, actor_role: role });
}
