// Flow graph type definitions — domain nodes for the visual flow builder.
// A flow is a directed graph of nodes connected by edges. When a message lands
// in any channel, flows are evaluated top-down: triggers match inbound events,
// conditions gate execution, actions perform side effects.

export type FlowNodeKind = "trigger" | "condition" | "action";

export type FlowTriggerType =
  | "commitment_detected"
  | "delivery_promise_made"
  | "discount_offered"
  | "payment_claimed"
  | "complaint_received";

export type FlowConditionType =
  | "risk_is_high"
  | "discount_above_threshold"
  | "customer_is_repeat";

export type FlowActionType =
  | "route_to_role"
  | "send_notification"
  | "lock_action"
  | "log_to_audit"
  | "create_commitment"
  | "escalate";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  type: FlowTriggerType | FlowConditionType | FlowActionType;
  // Configurable parameters per node type. Free-form so the builder UI can
  // produce any combination; the executor reads what it needs.
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  // Optional condition branch: "true" / "false" / undefined (default flow).
  branch?: "true" | "false" | undefined;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  created_at: string;
  updated_at: string;
}

// Lightweight input that the executor evaluates. A real flow trigger would
// build this from a parsed message; tests and the inline-detect path use it
// directly to keep the executor pure.
export interface FlowEvent {
  type: "message" | "commitment" | "approval" | "task";
  // The inbound message or commitment that triggered evaluation.
  payload: {
    commitment_type?: string;
    risk_tier?: "low" | "medium" | "high" | "critical";
    discount_pct?: number;
    customer_id?: string;
    customer_order_count?: number;
    message?: string;
    commitment_id?: string;
  };
}

export interface FlowActionResult {
  action: FlowActionType;
  node_id: string;
  ok: boolean;
  // Side-effect output (e.g. the new approval request id, the routed role).
  result: Record<string, unknown>;
  error?: string;
}

export interface FlowExecutionResult {
  flow_id: string;
  matched: boolean;
  // Trigger node id that matched the event (if any).
  trigger_id: string | null;
  // Nodes visited in evaluation order.
  path: string[];
  // Actions actually executed (after conditions passed).
  actions: FlowActionResult[];
  // Human-readable trace for the audit log + UI.
  trace: string[];
}
