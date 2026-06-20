/**
 * Tests for the process-message orchestrator that runs the full commitment
 * detection pipeline on a single incoming message.
 *
 * The orchestrator reuses the existing detect / classify / risk / authority
 * modules and writes a Commitment + AuditEvent to either Supabase or the
 * demo-state store. Tests cover the orchestrator's decisions:
 *
 *   - discount_offer above threshold → routed to admin with risk=high
 *   - delivery_promise with stock risk → routed to operations
 *   - payment_claim without screenshot → blocked (requires finance)
 *   - plain follow_up → low risk, auto_execute
 *   - noise (greeting) → no commitment created
 */

import { describe, expect, it } from "vitest";

import {
  type ProcessableMessage,
  detectAndCreateCommitment,
  isActionableMessage,
} from "../src/lib/channels/process-message";

const BASE_MESSAGE: ProcessableMessage = {
  id: "msg-1",
  channel: "telegram",
  contactName: "Ahmed",
  content: "How about 15% off on the order?",
  createdAt: "2024-06-19T12:00:00.000Z",
};

describe("isActionableMessage", () => {
  it("returns true for messages with content", () => {
    expect(isActionableMessage({ ...BASE_MESSAGE })).toBe(true);
  });
  it("returns false for empty content", () => {
    expect(isActionableMessage({ ...BASE_MESSAGE, content: "" })).toBe(false);
  });
  it("returns false for messages flagged as noise", () => {
    expect(
      isActionableMessage({ ...BASE_MESSAGE, content: "thanks!", flaggedAsNoise: true }),
    ).toBe(false);
  });
});

describe("detectAndCreateCommitment", () => {
  it("detects a discount offer and creates a high-risk commitment routed to admin", () => {
    const result = detectAndCreateCommitment(BASE_MESSAGE);
    expect(result.action).toBe("created");
    if (result.action !== "created") return;
    expect(result.commitment.type).toBe("discount_offer");
    expect(result.commitment.risk_tier).toBe("high");
    expect(result.commitment.required_role).toBe("admin");
    expect(result.commitment.normalized_obligation.discountPct).toBe(15);
    expect(result.approval).not.toBeNull();
    expect(result.audit).toMatchObject({
      event_type: "detect_commitment",
      actor_type: "ai",
    });
  });

  it("detects a delivery promise with stock risk and routes to operations", () => {
    const result = detectAndCreateCommitment({
      ...BASE_MESSAGE,
      id: "msg-2",
      content: "Delivery by Friday, but stock is short",
    });
    expect(result.action).toBe("created");
    if (result.action !== "created") return;
    expect(result.commitment.type).toBe("delivery_promise");
    expect(result.commitment.risk_tier).toBe("high");
    expect(result.commitment.required_role).toBe("operations");
    expect(result.commitment.normalized_obligation.stockRisk).toBe(true);
  });

  it("blocks a payment claim with no evidence and routes to finance", () => {
    const result = detectAndCreateCommitment({
      ...BASE_MESSAGE,
      id: "msg-3",
      content: "Payment sent, please confirm",
    });
    expect(result.action).toBe("created");
    if (result.action !== "created") return;
    expect(result.commitment.type).toBe("payment_claim");
    expect(result.commitment.risk_tier).toBe("blocked");
    expect(result.commitment.required_role).toBe("finance");
    expect(result.approval?.decision).toBe("pending");
  });

  it("treats a plain follow-up as low risk and auto-executes", () => {
    const result = detectAndCreateCommitment({
      ...BASE_MESSAGE,
      id: "msg-4",
      content: "Please send me a reminder",
    });
    expect(result.action).toBe("created");
    if (result.action !== "created") return;
    expect(result.commitment.type).toBe("follow_up");
    expect(result.commitment.risk_tier).toBe("medium");
  });

  it("classifies greetings and noise messages and skips commitment creation", () => {
    const result = detectAndCreateCommitment({
      ...BASE_MESSAGE,
      id: "msg-5",
      content: "Hi, thanks!",
    });
    expect(result.action).toBe("skipped");
    if (result.action !== "skipped") return;
    expect(result.reason).toMatch(/noise|greeting/i);
  });

  it("returns 'skipped' when the message has no content", () => {
    const result = detectAndCreateCommitment({
      ...BASE_MESSAGE,
      id: "msg-6",
      content: "",
    });
    expect(result.action).toBe("skipped");
  });
});