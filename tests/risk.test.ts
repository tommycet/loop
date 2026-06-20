import { describe, expect, it } from "vitest";

import { classifyRisk, type RiskInput } from "../src/lib/risk";

describe("classifyRisk", () => {
  it("flags a 10% discount offered by sales as high risk", () => {
    const input: RiskInput = {
      type: "discount_offer",
      normalizedObbligation: { discountPct: 10, actorRole: "sales" },
      text: "I think we can do 10% off if payment today.",
    };
    expect(classifyRisk(input)).toBe("high");
  });

  it("allows a 3% discount by sales to auto-execute as low risk", () => {
    const input: RiskInput = {
      type: "discount_offer",
      normalizedObbligation: { discountPct: 3, actorRole: "sales" },
      text: "We can give 3% off as goodwill.",
    };
    expect(classifyRisk(input)).toBe("low");
  });

  it("marks any refund request as blocked (requires finance)", () => {
    const input: RiskInput = {
      type: "refund_request",
      normalizedObbligation: { actorRole: "sales" },
      text: "Please refund the last invoice.",
    };
    expect(classifyRisk(input)).toBe("blocked");
  });

  it("flags a delivery commitment with shipping/stock risk as high", () => {
    const input: RiskInput = {
      type: "delivery_promise",
      normalizedOblligation: undefined,
      normalizedObbligation: { actorRole: "sales", dueInHours: 36, stockRisk: true },
      text: "Delivery by Friday no matter what.",
    };
    expect(classifyRisk(input)).toBe("high");
  });

  it("treats plain follow-up tasks as medium risk", () => {
    const input: RiskInput = {
      type: "follow_up",
      text: "Follow up on the quote tomorrow.",
      normalizedOblligation: undefined,
      normalizedObbligation: undefined,
    };
    expect(classifyRisk(input)).toBe("medium");
  });

  it("treats complaints about delays as high risk regardless of value", () => {
    const input: RiskInput = {
      type: "complaint",
      text: "This is the second time you promised Friday and missed.",
      normalizedOblligation: { actorRole: "sales" },
    };
    expect(classifyRisk(input)).toBe("high");
  });

  it("escalates payment_claim with no evidence to blocked", () => {
    const input: RiskInput = {
      type: "payment_claim",
      text: "Payment sent, please confirm.",
      normalizedObbligation: { actorRole: "customer", hasScreenshot: false },
    };
    expect(classifyRisk(input)).toBe("blocked");
  });
});