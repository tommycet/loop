export type Team = "sales" | "operations" | "finance" | "admin";
export type Channel = "whatsapp" | "email" | "voice" | "manual" | "telegram" | "slack";
export type Direction = "inbound" | "outbound";
export type MessageStatus = "pending" | "noise" | "extracted" | "failed" | "review_needed";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type Priority = "low" | "medium" | "high" | "critical";
export type FollowUpStatus = "scheduled" | "pending_approval" | "sent" | "failed";

// Commitment Control Plane types
export type CommitmentType =
  | "discount_offer"
  | "delivery_promise"
  | "payment_claim"
  | "refund_request"
  | "complaint"
  | "quote_request"
  | "follow_up"
  | "internal_task";

export type RiskTier = "low" | "medium" | "high" | "blocked";
export type CommitmentStatus =
  | "detected"
  | "needs_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "stale"
  | "escalated"
  | "closed";
export type ApprovalDecision = "pending" | "approved" | "edited" | "rejected" | "expired";

export interface Commitment {
  id: string;
  raw_message_id?: string | null;
  contact_id?: string | null;
  type: CommitmentType;
  extracted_text: string;
  normalized_obligation: Record<string, unknown>;
  risk_tier: RiskTier;
  status: CommitmentStatus;
  owner_id?: string | null;
  required_role?: Team | null;
  due_at?: string | null;
  confidence: number;
  evidence: Record<string, unknown>;
  source_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  commitment_id: string;
  required_role: Team | "admin";
  approver_id?: string | null;
  decided_by_role?: "viewer" | "admin" | "finance" | "operations" | "sales" | null;
  proposed_action: Record<string, unknown>;
  edited_action?: Record<string, unknown> | null;
  decision: ApprovalDecision;
  decision_reason?: string | null;
  decided_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  entity_type: "commitment" | "approval" | "follow_up" | "task" | "message";
  entity_id: string;
  event_type: string;
  actor_type: "ai" | "human" | "system";
  actor_id?: string | null;
  actor_role?: "viewer" | "admin" | "finance" | "operations" | "sales" | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuthorityRule {
  id: string;
  action_type: CommitmentType | string;
  required_role: Team;
  max_auto_threshold_pct?: number | null;
  max_auto_threshold_hours?: number | null;
  fail_mode: "draft_only" | "block" | "escalate";
  description?: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  team: Team;
  phone?: string | null;
  email?: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RawMessage {
  id: string;
  contact_id?: string | null;
  external_id: string;
  channel: Channel;
  direction: Direction;
  content?: string | null;
  media_url?: string | null;
  audio_url?: string | null;
  status: MessageStatus;
  raw_payload: Record<string, unknown>;
  created_at: string;
}

export interface Task {
  id: string;
  raw_message_id?: string | null;
  contact_id?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  owner_id?: string | null;
  due_at?: string | null;
  source_url?: string | null;
  plan_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  task_id: string;
  scheduled_at: string;
  sent_at?: string | null;
  escalation_level: number;
  channel: "whatsapp" | "email" | "app";
  message_draft?: string | null;
  status: FollowUpStatus;
  created_at: string;
}

export type ToolName =
  | "create_task"
  | "assign_owner"
  | "schedule_followup"
  | "draft_message"
  | "escalate"
  | "link_to_contact"
  | "ignore"
  | "ask_human"
  | "detect_commitment"
  | "create_commitment"
  | "route_approval"
  | "build_evidence_pack"
  | "execute_approved_action"
  | "write_audit_event"
  | "escalate_stale_commitment";

export interface ToolCall {
  ref?: string;
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface Run {
  id: string;
  raw_message_id?: string | null;
  model: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  plan_json: ToolCall[];
  outcome_json?: Record<string, unknown> | null;
  latency_ms?: number | null;
  created_at: string;
}
