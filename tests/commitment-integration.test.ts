import { describe, expect, it } from "vitest";

import { DEFAULT_AUTHORITY_RULES } from "../src/lib/commitments";
import { resolveAuthority } from "../src/lib/authority";
import { classifyRisk } from "../src/lib/risk";

describe("Integration: messy WhatsApp scenario", () => {
  it("classifies a 10% sales discount as high risk and routes to admin", () => {
    const tier = classifyRisk({
      type: "discount_offer",
      text: "I think we can do 10% off if payment today.",
      normalizedObbligation: { discountPct: 10, actorRole: "sales" },
    });
    expect(tier).toBe("high");
    const decision = resolveAuthority(
      {
        actionType: "discount_offer",
        riskTier: tier,
        actorRole: "sales",
        discountPct: 10,
      },
      DEFAULT_AUTHORITY_RULES,
    );
    expect(decision.decision).toBe("requires_approval");
    expect(decision.required_role).toBe("admin");
  });

  it("blocks refund request and routes to finance", () => {
    const tier = classifyRisk({
      type: "refund_request",
      text: "Please refund the last invoice.",
      normalizedObbligation: { actorRole: "sales" },
    });
    expect(tier).toBe("blocked");
    const decision = resolveAuthority(
      { actionType: "refund_request", riskTier: tier, actorRole: "sales" },
      DEFAULT_AUTHORITY_RULES,
    );
    expect(decision.decision).toBe("requires_approval");
    expect(decision.required_role).toBe("finance");
  });

  it("auto-executes small follow-up at medium tier", () => {
    const tier = classifyRisk({
      type: "follow_up",
      text: "Follow up tomorrow.",
      normalizedObbligation: { actorRole: "sales" },
    });
    expect(tier).toBe("medium");
    const decision = resolveAuthority(
      { actionType: "follow_up", riskTier: tier, actorRole: "sales" },
      DEFAULT_AUTHORITY_RULES,
    );
    expect(decision.decision).toBe("auto_execute");
  });

  it("escalates repeat complaint to admin", () => {
    const tier = classifyRisk({
      type: "complaint",
      text: "This is the second time you promised Friday and missed.",
      normalizedObbligation: { actorRole: "sales", isRepeatComplaint: true },
    });
    expect(tier).toBe("high");
    const decision = resolveAuthority(
      { actionType: "complaint", riskTier: tier, actorRole: "sales" },
      DEFAULT_AUTHORITY_RULES,
    );
    expect(decision.required_role).toBe("admin");
    expect(decision.fail_mode).toBe("escalate");
  });
});