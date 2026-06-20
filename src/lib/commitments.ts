import type {
  ApprovalRequest,
  AuditEvent,
  AuthorityRule,
  Commitment,
  CommitmentType,
  RiskTier,
  Team,
} from "../types";

/**
 * Default authority rules used in demo and seed data.
 * Mirrors what a small business would configure in the Authority Queue.
 */
export const DEFAULT_AUTHORITY_RULES: AuthorityRule[] = [
  {
    id: "rule-discount",
    action_type: "discount_offer",
    required_role: "admin",
    max_auto_threshold_pct: 5,
    fail_mode: "block",
    description: "Discounts above 5% require admin sign-off.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-refund",
    action_type: "refund_request",
    required_role: "finance",
    max_auto_threshold_pct: 0,
    fail_mode: "block",
    description: "All refunds require finance verification.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-delivery",
    action_type: "delivery_promise",
    required_role: "operations",
    max_auto_threshold_hours: 24,
    fail_mode: "draft_only",
    description: "Delivery commitments beyond 24h require ops approval.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-payment",
    action_type: "payment_claim",
    required_role: "finance",
    max_auto_threshold_hours: 0,
    fail_mode: "block",
    description: "Payment claims require finance verification before acknowledgement.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-complaint",
    action_type: "complaint",
    required_role: "admin",
    max_auto_threshold_hours: 0,
    fail_mode: "escalate",
    description: "Repeat complaints escalate to admin.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-quote",
    action_type: "quote_request",
    required_role: "sales",
    fail_mode: "draft_only",
    description: "Quote requests go to sales for ownership.",
    created_at: new Date(0).toISOString(),
  },
  {
    id: "rule-followup",
    action_type: "follow_up",
    required_role: "sales",
    fail_mode: "draft_only",
    description: "Follow-up assignments default to sales.",
    created_at: new Date(0).toISOString(),
  },
];

const teamByRole: Record<string, string> = {
  sales: "11111111-1111-1111-1111-111111111111",
  operations: "22222222-2222-2222-2222-222222222222",
  finance: "33333333-3333-3333-3333-333333333333",
  admin: "44444444-4444-4444-4444-444444444444",
};

export type SeedCommitment = Pick<
  Commitment,
  | "type"
  | "extracted_text"
  | "normalized_obligation"
  | "risk_tier"
  | "status"
  | "required_role"
  | "due_at"
  | "confidence"
  | "evidence"
>;

export const DEMO_COMMITMENTS: Array<SeedCommitment & { id: string; created_at: string; updated_at: string }> = [
  {
    id: "commitment-demo-1",
    type: "discount_offer",
    extracted_text: "I think we can do 10% off if he pays today.",
    normalized_obligation: { discountPct: 10, actorRole: "sales", actorName: "Sarah (Sales)" },
    risk_tier: "high",
    status: "needs_approval",
    required_role: "admin",
    due_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    confidence: 0.91,
    evidence: {
      sourceMessageId: "msg-demo-3",
      sourceChannel: "whatsapp",
      transcript: [
        "Ali Traders (WhatsApp): Need a quote for 20 office chairs by Friday. Deliver to DHA Lahore.",
        "Sarah (Sales): I think we can do 10% off if he pays today.",
        "Ali Traders: I'll pay now. Send details.",
      ],
      auditTrail: [
        { actor: "ai", event: "detect_commitment", at: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
        { actor: "ai", event: "classify_risk", decision: "high", reason: "10% discount above 5% threshold", at: new Date(Date.now() - 1000 * 60 * 7).toISOString() },
        { actor: "ai", event: "route_approval", requiredRole: "admin", reason: "exceeds auto threshold", at: new Date(Date.now() - 1000 * 60 * 7).toISOString() },
      ],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "commitment-demo-2",
    type: "delivery_promise",
    extracted_text: "Delivery by Friday no matter what.",
    normalized_obligation: { actorRole: "sales", dueInHours: 36, stockRisk: true, actorName: "Sarah (Sales)" },
    risk_tier: "high",
    status: "needs_approval",
    required_role: "operations",
    due_at: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    confidence: 0.78,
    evidence: {
      sourceMessageId: "msg-demo-4",
      sourceChannel: "voice",
      transcript: "Sarah (voice note): Tell him Friday for sure, stock is short but we'll manage.",
      auditTrail: [
        { actor: "ai", event: "detect_commitment", at: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
        { actor: "ai", event: "classify_risk", decision: "high", reason: "delivery beyond 24h with stock risk", at: new Date(Date.now() - 1000 * 60 * 24).toISOString() },
        { actor: "ai", event: "route_approval", requiredRole: "operations", reason: "delivery beyond safe window", at: new Date(Date.now() - 1000 * 60 * 24).toISOString() },
      ],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
  {
    id: "commitment-demo-3",
    type: "payment_claim",
    extracted_text: "Payment sent, please confirm.",
    normalized_obligation: { actorRole: "customer", hasScreenshot: true },
    risk_tier: "low",
    status: "executed",
    required_role: "finance",
    due_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    confidence: 0.88,
    evidence: {
      sourceMessageId: "msg-demo-5",
      sourceChannel: "whatsapp",
      transcript: [
        "Ali Traders: Payment sent. [image: payment_screenshot.png]",
        "Loop: Payment received, thank you. Quote remains 10% until owner approval.",
      ],
      auditTrail: [
        { actor: "ai", event: "detect_commitment", at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
        { actor: "ai", event: "classify_risk", decision: "low", reason: "screenshot present", at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
        { actor: "ai", event: "execute_approved_action", channel: "whatsapp", at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      ],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "commitment-demo-4",
    type: "complaint",
    extracted_text: "This is the second time you promised Friday and missed.",
    normalized_obligation: { actorRole: "sales", isRepeatComplaint: true },
    risk_tier: "high",
    status: "needs_approval",
    required_role: "admin",
    due_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    confidence: 0.94,
    evidence: {
      sourceMessageId: "msg-demo-6",
      sourceChannel: "whatsapp",
      transcript: [
        "Ali Traders: This is the second time you promised Friday and missed.",
        "Ali Traders: If it slips again I'm cancelling the order.",
      ],
      auditTrail: [
        { actor: "ai", event: "detect_commitment", at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
        { actor: "ai", event: "classify_risk", decision: "high", reason: "repeat complaint, escalation language", at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      ],
    },
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

export const DEMO_APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "approval-demo-1",
    commitment_id: "commitment-demo-1",
    required_role: "admin",
    approver_id: null,
    proposed_action: {
      type: "send_message",
      channel: "whatsapp",
      body: "We can confirm a 10% discount on 20 office chairs for DHA Lahore if payment is received today.",
    },
    edited_action: null,
    decision: "pending",
    decision_reason: null,
    decided_at: null,
    expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "approval-demo-2",
    commitment_id: "commitment-demo-2",
    required_role: "operations",
    approver_id: null,
    proposed_action: {
      type: "send_message",
      channel: "whatsapp",
      body: "Confirming delivery to DHA Lahore by Friday. 20 office chairs.",
    },
    edited_action: null,
    decision: "pending",
    decision_reason: null,
    decided_at: null,
    expires_at: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
  {
    id: "approval-demo-3",
    commitment_id: "commitment-demo-4",
    required_role: "admin",
    approver_id: null,
    proposed_action: {
      type: "send_message",
      channel: "whatsapp",
      body: "I'm sorry the previous Friday slipped. Here's what we're doing to make it right this time...",
    },
    edited_action: null,
    decision: "pending",
    decision_reason: null,
    decided_at: null,
    expires_at: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

export const DEMO_AUDIT_EVENTS: AuditEvent[] = DEMO_COMMITMENTS.flatMap((commitment) => {
  const trail = (commitment.evidence.auditTrail as Array<Record<string, unknown>>) ?? [];
  return trail.map((event, index) => ({
    id: `audit-${commitment.id}-${index}`,
    entity_type: "commitment" as const,
    entity_id: commitment.id,
    event_type: String(event.event ?? "unknown"),
    actor_type: "ai" as const,
    actor_id: null,
    payload: event,
    created_at: String(event.at ?? new Date().toISOString()),
  }));
});

export function ownerForRole(role: Team | "admin"): string {
  return teamByRole[role] ?? teamByRole.admin;
}

export function commitmentTypeLabel(type: CommitmentType): string {
  switch (type) {
    case "discount_offer":
      return "Discount offer";
    case "delivery_promise":
      return "Delivery promise";
    case "payment_claim":
      return "Payment claim";
    case "refund_request":
      return "Refund request";
    case "complaint":
      return "Customer complaint";
    case "quote_request":
      return "Quote request";
    case "follow_up":
      return "Follow-up";
    case "internal_task":
      return "Internal task";
  }
}

export function riskTierLabel(tier: RiskTier): string {
  switch (tier) {
    case "low":
      return "low risk";
    case "medium":
      return "medium risk";
    case "high":
      return "high risk";
    case "blocked":
      return "blocked";
  }
}