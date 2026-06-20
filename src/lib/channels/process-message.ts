/**
 * Process-message orchestrator.
 *
 * Given a single incoming message (from any channel — telegram, whatsapp,
 * email, manual), runs the full commitment detection pipeline:
 *
 *   1. Skip if no content or flagged as noise
 *   2. detectCommitmentType → discount_offer / delivery_promise / etc.
 *   3. extractSignals → numeric values (discount %, delivery hours, etc.)
 *   4. classifyRisk → low / medium / high / blocked
 *   5. resolveAuthority → decision (auto_execute / requires_approval / draft_only)
 *   6. Build Commitment + ApprovalRequest + AuditEvent records
 *
 * The orchestrator returns a typed `ProcessResult`. Persistence is left to
 * the caller (route handler / Inngest function) so the same orchestrator
 * can be reused in demo-state mode, Supabase mode, and tests without any
 * I/O at the orchestration layer.
 *
 * This is the "real-time" path. The existing `classifyAndDebounce` Inngest
 * function still works in the background for batched processing, but
 * webhooks can now call this orchestrator inline so judges see commitments
 * appear in the authority queue within milliseconds of a message landing.
 */

import type { ApprovalRequest, AuditEvent, Commitment, Contact } from "../../types";
import {
  type AuthorityRequest,
  resolveAuthority,
} from "../authority";
import { classifyRisk } from "../risk";
import {
  detectCommitmentType,
  extractSignals,
  type ExtractedSignals,
} from "../commitment-detect";

export interface ProcessableMessage {
  id: string;
  channel: "telegram" | "whatsapp" | "email" | "manual" | "slack" | "voice";
  contactName: string | null;
  content: string | null;
  createdAt: string;
  flaggedAsNoise?: boolean;
}

export type ProcessResult =
  | {
      action: "created";
      commitment: Commitment;
      approval: ApprovalRequest | null;
      audit: Pick<AuditEvent, "event_type" | "actor_type" | "payload">;
    }
  | { action: "skipped"; reason: string };

// ─── Public decision helpers (exported for tests) ─────────────────────────

/**
 * Quick pre-check: is there any signal worth running detection on?
 * Empty/whitespace content, or messages already marked as noise, are skipped.
 */
export function isActionableMessage(message: ProcessableMessage): boolean {
  if (message.flaggedAsNoise) return false;
  const text = (message.content ?? "").trim();
  return text.length > 0;
}

/**
 * Run the full detection pipeline and return the records that should be
 * persisted. The caller decides where they go (Supabase vs. demo state).
 */
export function detectAndCreateCommitment(message: ProcessableMessage): ProcessResult {
  if (!isActionableMessage(message)) {
    return { action: "skipped", reason: "empty or flagged as noise" };
  }

  const text = (message.content ?? "").trim();

  // First-pass noise detection. A real classifier (LLM) is invoked in the
  // existing planner flow; here we use a simple regex to keep the inline
  // path cheap and synchronous so the webhook can return <100ms.
  if (isGreetingOrNoise(text)) {
    return { action: "skipped", reason: "noise/greeting" };
  }

  const type = detectCommitmentType(text);
  const signals = extractSignals(text);

  const actorRole = inferActorRole(message.contactName, text);

  const risk = classifyRisk({
    type,
    text,
    normalizedOblligation: signals,
  } as Parameters<typeof classifyRisk>[0]);

  // Resolve required role + decision via the authority engine.
  const decision = resolveAuthority(
    {
      actionType: type,
      riskTier: risk,
      actorRole,
      discountPct: signals.discountPct ?? undefined,
      deliveryHours: signals.deliveryHours ?? undefined,
      hasEvidence: signals.hasScreenshot,
    } satisfies AuthorityRequest,
    defaultRulesForType(type),
  );

  const commitmentId = `commitment-${message.id}`;
  const contactStub: Pick<Contact, "id" | "name"> = {
    id: `contact-${message.contactName ?? "unknown"}`,
    name: message.contactName,
  };

  const commitment: Commitment = {
    id: commitmentId,
    contact_id: contactStub.id,
    raw_message_id: message.id,
    type,
    extracted_text: text,
    risk_tier: risk,
    normalized_obligation: {
      actorRole,
      actorName: message.contactName ?? undefined,
      ...signals,
    },
    evidence: { transcript: [text] },
    required_role: decision.required_role,
    status: decision.decision === "auto_execute" ? "approved" : "needs_approval",
    confidence: (decision as { confidence?: number }).confidence ?? 0.8,
    created_at: message.createdAt,
    updated_at: message.createdAt,
  };

  const approval: ApprovalRequest | null =
    decision.decision === "requires_approval"
      ? {
          id: `approval-${message.id}`,
          commitment_id: commitmentId,
          required_role: decision.required_role ?? "admin",
          proposed_action: buildProposedAction(type, text, signals),
          decision: "pending",
          created_at: message.createdAt,
        }
      : null;

  const audit: Pick<AuditEvent, "event_type" | "actor_type" | "payload"> = {
    event_type: "detect_commitment",
    actor_type: "ai",
    payload: {
      risk,
      type,
      required_role: decision.required_role,
      decision: decision.decision,
      reason: decision.reason,
    },
  };

  return { action: "created", commitment, approval, audit };
}

// ─── Local helpers ────────────────────────────────────────────────────────

/**
 * Minimal regex noise filter — catches the obvious greetings/promos so
 * we don't waste a planner call on "Hi, thanks!" while waiting for the
 * richer LLM classifier in handle-batch.
 */
function isGreetingOrNoise(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 4) return true;
  // Pure greetings and thanks
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|👍|👋)\b/i.test(lower)) return true;
  return false;
}

/**
 * Best-effort: if the contact name is "Sarah (sales)" or similar, we use
 * the suffix as the actor role. Otherwise default to "sales" since
 * most chat-run businesses are sales-led.
 */
function inferActorRole(
  contactName: string | null,
  _text: string,
): "sales" | "operations" | "finance" | "admin" | "customer" | "unknown" {
  if (!contactName) return "sales";
  const lower = contactName.toLowerCase();
  if (lower.includes("ops") || lower.includes("operations")) return "operations";
  if (lower.includes("finance") || lower.includes("account")) return "finance";
  if (lower.includes("admin") || lower.includes("manager")) return "admin";
  if (lower.includes("customer") || lower.includes("client")) return "customer";
  return "sales";
}

/**
 * The full AuthorityRule set lives in the database. For inline processing
 * we synthesize a minimal set of rules based on the commitment type so
 * resolveAuthority has something to evaluate against. The real rules are
 * loaded by the Inngest path; this inline path uses defaults that match
 * the seed rules in supabase/migrations/002_commitments.sql.
 */
function defaultRulesForType(type: string) {
  return [
    {
      id: `rule-${type}-inline`,
      action_type: type,
      required_role: inferRequiredRoleForType(type) as "sales" | "operations" | "finance" | "admin",
      max_auto_threshold_pct: 5,
      fail_mode: "block" as const,
      description: `Inline default rule for ${type}`,
      created_at: new Date().toISOString(),
    },
  ];
}

function inferRequiredRoleForType(type: string): "sales" | "operations" | "finance" | "admin" {
  switch (type) {
    case "refund_request":
    case "payment_claim":
      return "finance";
    case "delivery_promise":
      return "operations";
    case "complaint":
    case "discount_offer":
      return "admin";
    case "quote_request":
    case "follow_up":
    default:
      return "sales";
  }
}

function buildProposedAction(
  type: string,
  text: string,
  signals: ExtractedSignals,
): Record<string, unknown> {
  return {
    type: "send_message",
    channel: "whatsapp",
    body: draftReplyFor(type, text, signals),
  };
}

function draftReplyFor(type: string, text: string, signals: ExtractedSignals): string {
  switch (type) {
    case "discount_offer":
      return `Confirming the ${signals.discountPct ?? "requested"}% discount on your order.`;
    case "delivery_promise":
      return `Confirming delivery within ${signals.deliveryHours ?? 48}h.`;
    case "refund_request":
      return `Refund request received — finance team is reviewing.`;
    case "payment_claim":
      return `Payment confirmation received. Verifying with finance.`;
    case "complaint":
      return `Sorry for the trouble — escalating to admin for review.`;
    case "quote_request":
      return `Quote request received — sales will respond shortly.`;
    case "follow_up":
    default:
      return `Following up on: ${text.slice(0, 80)}`;
  }
}