import { describe, expect, it } from "vitest";

import { detectCommitmentType, extractSignals, roleForApproval } from "../src/lib/commitment-detect";
import { DEFAULT_AUTHORITY_RULES } from "../src/lib/commitments";

describe("detectCommitmentType", () => {
  it("detects refunds and payment claims", () => {
    expect(detectCommitmentType("please refund the order")).toBe("refund_request");
    expect(detectCommitmentType("payment sent, please confirm")).toBe("payment_claim");
  });

  it("detects discount offers and delivery promises", () => {
    expect(detectCommitmentType("we can do 10% off")).toBe("discount_offer");
    expect(detectCommitmentType("delivery by Friday")).toBe("delivery_promise");
  });

  it("detects complaints and quotes", () => {
    expect(detectCommitmentType("this is the second time you missed")).toBe("complaint");
    expect(detectCommitmentType("please send a quote")).toBe("quote_request");
  });

  it("falls back to follow_up when nothing obvious matches", () => {
    expect(detectCommitmentType("noted")).toBe("follow_up");
  });
});

describe("extractSignals", () => {
  it("extracts percentage and delivery window", () => {
    const signals = extractSignals("10% off if delivered in 2 days");
    expect(signals.discountPct).toBe(10);
    expect(signals.deliveryHours).toBe(48);
  });

  it("detects screenshot evidence", () => {
    expect(extractSignals("payment sent [screenshot]").hasScreenshot).toBe(true);
    expect(extractSignals("payment sent").hasScreenshot).toBe(false);
  });

  it("flags stock risk and repeat complaint", () => {
    const signals = extractSignals("stock is short but second time you missed");
    expect(signals.stockRisk).toBe(true);
    expect(signals.isRepeatComplaint).toBe(true);
  });
});

describe("roleForApproval", () => {
  it("routes refund requests to finance even without a matching rule", () => {
    expect(roleForApproval("refund_request", "blocked", [])).toBe("finance");
  });

  it("routes high-tier discount to admin when no rule matches", () => {
    expect(roleForApproval("discount_offer", "high", [])).toBe("admin");
  });

  it("uses the configured rule role when present", () => {
    expect(roleForApproval("discount_offer", "high", DEFAULT_AUTHORITY_RULES)).toBe("admin");
    expect(roleForApproval("delivery_promise", "medium", DEFAULT_AUTHORITY_RULES)).toBe("operations");
  });
});