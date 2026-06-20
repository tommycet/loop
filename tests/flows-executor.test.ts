// Tests for the flow executor. The executor walks the graph: matches a
// trigger, evaluates conditions, runs actions. Pure functions, no I/O —
// side effects are recorded as results, not executed.
import { describe, it, expect } from "vitest";
import {
  evaluateFlow,
  validateFlow,
  buildFlow,
  exampleFlows,
} from "@/lib/flows/executor";
import type { Flow, FlowEvent } from "@/types/flow";

describe("flow executor", () => {
  describe("validateFlow", () => {
    it("rejects an empty flow", () => {
      const result = validateFlow({ nodes: [], edges: [] } as unknown as Flow);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain("flow has no nodes");
    });

    it("rejects a flow with no triggers", () => {
      const flow: Flow = buildFlow({
        name: "no-trigger",
        nodes: [
          { id: "c1", kind: "condition", type: "risk_is_high" },
          { id: "a1", kind: "action", type: "log_to_audit" },
        ],
        edges: [{ id: "e1", source: "c1", target: "a1" }],
      });
      const result = validateFlow(flow);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("trigger"))).toBe(true);
    });

    it("rejects an edge that points to a missing node", () => {
      const flow: Flow = buildFlow({
        name: "dangling",
        nodes: [{ id: "t1", kind: "trigger", type: "commitment_detected" }],
        edges: [{ id: "e1", source: "t1", target: "ghost" }],
      });
      const result = validateFlow(flow);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("ghost"))).toBe(true);
    });

    it("rejects an action that has no inbound edge", () => {
      const flow: Flow = buildFlow({
        name: "orphan-action",
        nodes: [
          { id: "t1", kind: "trigger", type: "commitment_detected" },
          { id: "a1", kind: "action", type: "log_to_audit" },
        ],
        edges: [], // a1 has no inbound edge
      });
      const result = validateFlow(flow);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes("a1"))).toBe(true);
    });

    it("accepts a well-formed flow", () => {
      const flow = exampleFlows.discountApproval(15);
      const result = validateFlow(flow);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("evaluateFlow", () => {
    it("returns matched=false when no trigger matches the event", () => {
      const flow = exampleFlows.discountApproval(15);
      const event: FlowEvent = {
        type: "message",
        payload: { message: "no commitments here" },
      };
      const result = evaluateFlow(flow, event);
      expect(result.matched).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it("triggers the discount-offered flow on a 20% discount event", () => {
      const flow = exampleFlows.discountApproval(15);
      const event: FlowEvent = {
        type: "commitment",
        payload: {
          commitment_type: "discount_offer",
          risk_tier: "high",
          discount_pct: 20,
        },
      };
      const result = evaluateFlow(flow, event);
      expect(result.matched).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);
      const routed = result.actions.find((a) => a.action === "route_to_role");
      expect(routed).toBeDefined();
      expect(routed?.result).toMatchObject({ role: "admin" });
    });

    it("does NOT trigger the discount flow when discount is below threshold", () => {
      const flow = exampleFlows.discountApproval(15);
      const event: FlowEvent = {
        type: "commitment",
        payload: {
          commitment_type: "discount_offer",
          risk_tier: "low",
          discount_pct: 5,
        },
      };
      const result = evaluateFlow(flow, event);
      // Trigger fires (commitment_detected) but condition fails so no actions.
      expect(result.matched).toBe(true);
      const routed = result.actions.find((a) => a.action === "route_to_role");
      expect(routed).toBeUndefined();
    });

    it("evaluates the true-branch: lock_action fires when condition=true", () => {
      const flow = exampleFlows.deliveryPromiseStockCheck();
      const event: FlowEvent = {
        type: "commitment",
        payload: {
          commitment_type: "delivery_promise",
          risk_tier: "medium",
          // customer_is_repeat -> true when order_count > 1
          customer_order_count: 5,
        },
      };
      const result = evaluateFlow(flow, event);
      expect(result.matched).toBe(true);
      // The true-branch should lock action and route to ops.
      const lock = result.actions.find((a) => a.action === "lock_action");
      const route = result.actions.find((a) => a.action === "route_to_role");
      expect(lock).toBeDefined();
      expect(route).toBeDefined();
    });

    it("evaluates the false-branch: send_notification when condition=false", () => {
      const flow = exampleFlows.deliveryPromiseStockCheck();
      const event: FlowEvent = {
        type: "commitment",
        payload: {
          commitment_type: "delivery_promise",
          risk_tier: "low",
          // customer_is_repeat -> false when order_count <= 1
          customer_order_count: 1,
        },
      };
      const result = evaluateFlow(flow, event);
      expect(result.matched).toBe(true);
      // False-branch: send_notification, no lock_action.
      const notify = result.actions.find((a) => a.action === "send_notification");
      const lock = result.actions.find((a) => a.action === "lock_action");
      expect(notify).toBeDefined();
      expect(lock).toBeUndefined();
    });

    it("skips a flow that is disabled", () => {
      const flow = { ...exampleFlows.discountApproval(15), enabled: false };
      const event: FlowEvent = {
        type: "commitment",
        payload: { commitment_type: "discount_offer", discount_pct: 20 },
      };
      const result = evaluateFlow(flow, event);
      expect(result.matched).toBe(false);
    });

    it("does not infinite-loop on cycles by tracking visited nodes", () => {
      const flow: Flow = buildFlow({
        name: "cyclic",
        nodes: [
          { id: "t1", kind: "trigger", type: "commitment_detected" },
          { id: "c1", kind: "condition", type: "risk_is_high" },
          { id: "a1", kind: "action", type: "log_to_audit" },
        ],
        edges: [
          { id: "e1", source: "t1", target: "c1" },
          { id: "e2", source: "c1", target: "a1", branch: "true" },
          { id: "e3", source: "a1", target: "c1" }, // cycle
        ],
      });
      const event: FlowEvent = {
        type: "commitment",
        payload: { commitment_type: "discount_offer", risk_tier: "high" },
      };
      const result = evaluateFlow(flow, event);
      // Should terminate — no infinite loop.
      expect(result.actions.length).toBeGreaterThan(0);
      // a1 should only fire once.
      const aCount = result.actions.filter((a) => a.node_id === "a1").length;
      expect(aCount).toBe(1);
    });

    it("traces the path of visited nodes for the audit log", () => {
      const flow = exampleFlows.discountApproval(15);
      const event: FlowEvent = {
        type: "commitment",
        payload: {
          commitment_type: "discount_offer",
          discount_pct: 25,
          risk_tier: "high",
        },
      };
      const result = evaluateFlow(flow, event);
      expect(result.path[0]).toBe("t1"); // trigger first
      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.trace.some((t) => t.includes("trigger"))).toBe(true);
    });
  });

  describe("exampleFlows templates", () => {
    it("discountApproval contains a threshold condition + admin routing", () => {
      const flow = exampleFlows.discountApproval(20);
      const conditions = flow.nodes.filter((n) => n.kind === "condition");
      const actions = flow.nodes.filter((n) => n.kind === "action");
      expect(conditions.some((n) => n.type === "discount_above_threshold")).toBe(true);
      expect(actions.some((n) => n.type === "route_to_role")).toBe(true);
    });

    it("deliveryPromiseStockCheck contains a condition with true/false branches", () => {
      const flow = exampleFlows.deliveryPromiseStockCheck();
      const trueEdges = flow.edges.filter((e) => e.branch === "true");
      const falseEdges = flow.edges.filter((e) => e.branch === "false");
      expect(trueEdges.length).toBeGreaterThan(0);
      expect(falseEdges.length).toBeGreaterThan(0);
    });

    it("repeatComplaintEscalation uses the customer_is_repeat condition", () => {
      const flow = exampleFlows.repeatComplaintEscalation();
      const conds = flow.nodes.filter((n) => n.type === "customer_is_repeat");
      expect(conds.length).toBe(1);
    });
  });
});
