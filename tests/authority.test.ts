import { describe, expect, it } from "vitest";

import { resolveAuthority, type AuthorityRule, type AuthorityRequest } from "../src/lib/authority";

const baseRules: AuthorityRule[] = [
  {
    id: "rule-discount",
    action_type: "discount_offer",
    required_role: "admin",
    max_auto_threshold_pct: 5,
    fail_mode: "block",
  },
  {
    id: "rule-refund",
    action_type: "refund_request",
    required_role: "finance",
    max_auto_threshold_pct: 0,
    fail_mode: "block",
  },
  {
    id: "rule-delivery",
    action_type: "delivery_promise",
    required_role: "operations",
    max_auto_threshold_hours: 24,
    fail_mode: "draft_only",
  },
  {
    id: "rule-payment",
    action_type: "payment_claim",
    required_role: "finance",
    max_auto_threshold_hours: 0,
    fail_mode: "block",
  },
];

describe("resolveAuthority", () => {
  it("blocks discount above threshold and routes to admin", () => {
    const request: AuthorityRequest = {
      actionType: "discount_offer",
      riskTier: "high",
      actorRole: "sales",
      discountPct: 10,
    };
    const decision = resolveAuthority(request, baseRules);
    expect(decision.decision).toBe("requires_approval");
    expect(decision.required_role).toBe("admin");
    expect(decision.reason).toMatch(/exceed/i);
  });

  it("auto-approves small discount within threshold", () => {
    const request: AuthorityRequest = {
      actionType: "discount_offer",
      riskTier: "low",
      actorRole: "sales",
      discountPct: 3,
    };
    const decision = resolveAuthority(request, baseRules);
    expect(decision.decision).toBe("auto_execute");
    expect(decision.required_role).toBeNull();
  });

  it("blocks refunds outright and routes to finance", () => {
      const request: AuthorityRequest = {
        actionType: "refund_request",
        riskTier: "blocked",
        actorRole: "sales",
      };
      const decision = resolveAuthority(request, baseRules);
      expect(decision.decision).toBe("requires_approval");
      expect(decision.required_role).toBe("finance");
      expect(decision.fail_mode).toBe("block");
    });

    it("drafts-only delivery commitments beyond safe window", () => {
      const request: AuthorityRequest = {
        actionType: "delivery_promise",
        riskTier: "medium",
        actorRole: "sales",
        deliveryHours: 72,
      };
      const decision = resolveAuthority(request, baseRules);
      expect(decision.decision).toBe("requires_approval");
      expect(decision.required_role).toBe("operations");
      expect(decision.fail_mode).toBe("draft_only");
    });

  it("auto-executes delivery within safe window", () => {
    const request: AuthorityRequest = {
      actionType: "delivery_promise",
      riskTier: "low",
      actorRole: "sales",
      deliveryHours: 12,
    };
    const decision = resolveAuthority(request, baseRules);
    expect(decision.decision).toBe("auto_execute");
  });

  it("blocks payment claim without evidence and routes to finance", () => {
      const request: AuthorityRequest = {
        actionType: "payment_claim",
        riskTier: "blocked",
        actorRole: "customer",
        hasEvidence: false,
      };
      const decision = resolveAuthority(request, baseRules);
      expect(decision.decision).toBe("requires_approval");
      expect(decision.required_role).toBe("finance");
    });

    it("falls back to admin with block when no rule matches", () => {
      const request: AuthorityRequest = {
        actionType: "unknown",
        riskTier: "medium",
        actorRole: "sales",
      };
      const decision = resolveAuthority(request, baseRules);
      expect(decision.decision).toBe("requires_approval");
      expect(decision.required_role).toBe("admin");
      expect(decision.fail_mode).toBe("block");
      expect(decision.reason).toMatch(/no rule/i);
    });
  });