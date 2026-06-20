// Flow executor — walks a flow graph and produces a pure result.
// No I/O, no DB writes, no side effects. The caller (API route) is
// responsible for acting on FlowActionResult entries.
//
// Algorithm:
//   1. Find the trigger node that matches the event.
//   2. From the trigger, traverse edges in topological order.
//   3. At each condition node, branch on true/false edges.
//   4. At each action node, evaluate the action and record the result.
//   5. Cycle-safe via a visited set.

import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowEvent,
  FlowActionResult,
  FlowExecutionResult,
} from "@/types/flow";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateFlow(flow: Flow): ValidationResult {
  const errors: string[] = [];
  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push("flow has no nodes");
    return { ok: false, errors };
  }
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  if (nodeIds.size !== flow.nodes.length) {
    errors.push("flow has duplicate node ids");
  }
  const triggers = flow.nodes.filter((n) => n.kind === "trigger");
  if (triggers.length === 0) {
    errors.push("flow has no trigger nodes");
  }
  // Edges must reference real nodes.
  for (const e of flow.edges) {
    if (!nodeIds.has(e.source)) errors.push(`edge ${e.id} source ${e.source} missing`);
    if (!nodeIds.has(e.target)) errors.push(`edge ${e.id} target ${e.target} missing`);
  }
  // Every action must have at least one inbound edge.
  const inbound = new Set(flow.edges.map((e) => e.target));
  for (const n of flow.nodes) {
    if (n.kind === "action" && !inbound.has(n.id)) {
      errors.push(`action node ${n.id} has no inbound edge`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function evaluateFlow(flow: Flow, event: FlowEvent): FlowExecutionResult {
  const trace: string[] = [];
  const path: string[] = [];
  const actions: FlowActionResult[] = [];
  const visited = new Set<string>();

  if (!flow.enabled) {
    trace.push(`flow ${flow.name || flow.id} disabled, skipping`);
    return { flow_id: flow.id, matched: false, trigger_id: null, path, actions, trace };
  }

  // 1. Find matching trigger.
  const trigger = flow.nodes.find(
    (n) => n.kind === "trigger" && triggerMatches(n, event)
  );
  if (!trigger) {
    trace.push(`no trigger matched event type=${event.type}`);
    return { flow_id: flow.id, matched: false, trigger_id: null, path, actions, trace };
  }

  trace.push(`trigger ${trigger.id} (${trigger.type}) matched`);
  // Don't pre-mark trigger as visited; the loop will mark it on first pop.

  // 2. Walk forward from the trigger, following edges in topological order.
  // Queue entries are { nodeId } — the next node to evaluate, not the edge.
  // We resolve edges at pop-time so we can branch on condition results.
  type Step = { nodeId: string };
  const queue: Step[] = [{ nodeId: trigger.id }];
  const adj = buildAdjacency(flow.edges);
  // Each step records the branch that produced it, so condition-true/false
  // edges can be filtered correctly.
  const incomingBranch = new Map<string, "true" | "false" | undefined>();
  incomingBranch.set(trigger.id, undefined);

  while (queue.length > 0) {
    const { nodeId } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    visited.add(nodeId);
    path.push(nodeId);

    if (node.kind === "trigger") {
      // continue to outgoing edges
    } else if (node.kind === "condition") {
      const result = conditionMatches(node, event, flow);
      trace.push(`condition ${node.id} (${node.type}) -> ${result ? "true" : "false"}`);
      // Stamp branch on outgoing edges for the children to read.
      for (const e of adj.get(nodeId) || []) {
        if (e.branch && (e.branch === "true" || e.branch === "false")) {
          incomingBranch.set(e.target, e.branch);
        } else {
          incomingBranch.set(e.target, undefined);
        }
      }
    } else if (node.kind === "action") {
      const actionResult = runAction(node, event);
      actions.push(actionResult);
      trace.push(`action ${node.id} (${node.type}) -> ${actionResult.ok ? "ok" : "err"}`);
      // Actions are leaves for execution purposes.
      continue;
    }

    // Enqueue children, filtering by incoming branch.
    for (const e of adj.get(nodeId) || []) {
      if (visited.has(e.target)) continue;
      const required = e.branch; // may be undefined for default edges
      if (required === "true" || required === "false") {
        // Only follow if the parent's branch matches.
        const node = flow.nodes.find((n) => n.id === nodeId);
        if (node && node.kind === "condition") {
          const condResult = conditionMatches(node, event, flow);
          if (required !== (condResult ? "true" : "false")) continue;
        }
      }
      queue.push({ nodeId: e.target });
    }
  }

  return {
    flow_id: flow.id,
    matched: actions.length > 0 || path.length > 1,
    trigger_id: trigger.id,
    path,
    actions,
    trace,
  };
}

function triggerMatches(node: FlowNode, event: FlowEvent): boolean {
  if (event.type !== "commitment" && event.type !== "message") return false;
  const ct = event.payload.commitment_type;
  switch (node.type) {
    case "commitment_detected":
      // Matches any detected commitment (any type).
      return !!ct;
    case "delivery_promise_made":
      return ct === "delivery_promise";
    case "discount_offered":
      return ct === "discount_offer";
    case "payment_claimed":
      return ct === "payment_claim";
    case "complaint_received":
      return ct === "complaint";
    default:
      return false;
  }
}

function conditionMatches(node: FlowNode, event: FlowEvent, flow: Flow): boolean {
  switch (node.type) {
    case "risk_is_high":
      return event.payload.risk_tier === "high" || event.payload.risk_tier === "critical";
    case "discount_above_threshold": {
      const threshold = Number(node.config.threshold ?? 10);
      return (event.payload.discount_pct ?? 0) > threshold;
    }
    case "customer_is_repeat":
      return (event.payload.customer_order_count ?? 0) > 1;
    default:
      return false;
  }
  // Suppress unused param warning.
  void flow;
}

function runAction(node: FlowNode, event: FlowEvent): FlowActionResult {
  try {
    switch (node.type) {
      case "route_to_role": {
        const role = String(node.config.role ?? "admin");
        return { action: "route_to_role", node_id: node.id, ok: true, result: { role, commitment_id: event.payload.commitment_id ?? null } };
      }
      case "send_notification": {
        const channel = String(node.config.channel ?? "admin");
        return { action: "send_notification", node_id: node.id, ok: true, result: { to: channel, message: event.payload.message ?? null } };
      }
      case "lock_action": {
        return { action: "lock_action", node_id: node.id, ok: true, result: { locked: true, reason: String(node.config.reason ?? "flow_policy") } };
      }
      case "log_to_audit": {
        return { action: "log_to_audit", node_id: node.id, ok: true, result: { logged: true, event_type: event.type } };
      }
      case "create_commitment": {
        return { action: "create_commitment", node_id: node.id, ok: true, result: { created: true, type: event.payload.commitment_type ?? null } };
      }
      case "escalate": {
        return { action: "escalate", node_id: node.id, ok: true, result: { escalated_to: String(node.config.role ?? "admin") } };
      }
      default:
        return { action: "escalate", node_id: node.id, ok: false, result: {}, error: `unknown action type: ${String(node.type)}` };
    }
  } catch (err) {
    return { action: "escalate", node_id: node.id, ok: false, result: {}, error: String(err) };
  }
}

function buildAdjacency(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const m = new Map<string, FlowEdge[]>();
  for (const e of edges) {
    const list = m.get(e.source) || [];
    list.push(e);
    m.set(e.source, list);
  }
  return m;
}

// Build a Flow from a partial spec. Stamps timestamps and ids.
export function buildFlow(spec: {
  name: string;
  description?: string;
  nodes: Array<Omit<FlowNode, "position"> & { position?: { x: number; y: number } }>;
  edges: Array<Omit<FlowEdge, "id"> & { id?: string }>;
  enabled?: boolean;
}): Flow {
  const now = new Date().toISOString();
  const id = `flow-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    name: spec.name,
    description: spec.description,
    enabled: spec.enabled ?? true,
    nodes: spec.nodes.map((n) => ({ ...n, position: n.position ?? { x: 0, y: 0 } })),
    edges: spec.edges.map((e, i) => ({ id: e.id ?? `${id}-e${i}`, ...e })),
    created_at: now,
    updated_at: now,
  };
}

// Pre-built templates for the builder UI.
export const exampleFlows = {
  discountApproval(threshold = 15): Flow {
    return buildFlow({
      name: `Discount > ${threshold}% requires admin`,
      description: "Any discount above threshold is routed to admin for approval.",
      nodes: [
        { id: "t1", kind: "trigger", type: "discount_offered", config: {}, position: { x: 0, y: 0 } },
        { id: "c1", kind: "condition", type: "discount_above_threshold", config: { threshold }, position: { x: 240, y: 0 } },
        { id: "a1", kind: "action", type: "route_to_role", config: { role: "admin" }, position: { x: 480, y: -80 } },
        { id: "a2", kind: "action", type: "lock_action", config: { reason: "discount_exceeds_threshold" }, position: { x: 480, y: 80 } },
        { id: "a3", kind: "action", type: "log_to_audit", config: {}, position: { x: 720, y: 0 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", branch: "true" },
        { id: "e3", source: "c1", target: "a3", branch: "false" },
        { id: "e4", source: "a1", target: "a2" },
      ],
    });
  },

  deliveryPromiseStockCheck(): Flow {
    return buildFlow({
      name: "Delivery promise: stock check before commit",
      description: "If stock is below threshold, lock action and route to ops; otherwise auto-confirm.",
      nodes: [
        { id: "t1", kind: "trigger", type: "delivery_promise_made", config: {}, position: { x: 0, y: 0 } },
        { id: "c1", kind: "condition", type: "customer_is_repeat", config: {}, position: { x: 240, y: 0 } },
        { id: "a1", kind: "action", type: "route_to_role", config: { role: "operations" }, position: { x: 480, y: -100 } },
        { id: "a2", kind: "action", type: "lock_action", config: { reason: "stock_below_threshold" }, position: { x: 480, y: -40 } },
        { id: "a3", kind: "action", type: "send_notification", config: { channel: "customer" }, position: { x: 480, y: 80 } },
        { id: "a4", kind: "action", type: "log_to_audit", config: {}, position: { x: 720, y: 0 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", branch: "true" },
        { id: "e3", source: "c1", target: "a2", branch: "true" },
        { id: "e4", source: "c1", target: "a3", branch: "false" },
        { id: "e5", source: "a1", target: "a4" },
        { id: "e6", source: "a2", target: "a4" },
        { id: "e7", source: "a3", target: "a4" },
      ],
    });
  },

  repeatComplaintEscalation(): Flow {
    return buildFlow({
      name: "Repeat complaint escalation",
      description: "If the customer has complained before, escalate to admin immediately.",
      nodes: [
        { id: "t1", kind: "trigger", type: "complaint_received", config: {}, position: { x: 0, y: 0 } },
        { id: "c1", kind: "condition", type: "customer_is_repeat", config: {}, position: { x: 240, y: 0 } },
        { id: "a1", kind: "action", type: "escalate", config: { role: "admin" }, position: { x: 480, y: -40 } },
        { id: "a2", kind: "action", type: "log_to_audit", config: {}, position: { x: 480, y: 40 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", branch: "true" },
        { id: "e3", source: "c1", target: "a2", branch: "false" },
      ],
    });
  },
};
