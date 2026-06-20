import { describe, expect, it } from "vitest";

import { executeTool } from "../src/lib/tools";

describe("Commitment Control Plane tools", () => {
  const ctx = {
    messageId: "msg-test-1",
    contactId: "contact-test-1",
    teamMembers: [{ id: "tm-1", name: "Sarah (Sales)", team: "sales" as const }],
  };

  it("detect_commitment returns a stable id with normalized payload", async () => {
    const result = await executeTool(
      "detect_commitment",
      {
        type: "discount_offer",
        extracted_text: "I think we can do 10% off if payment today",
        normalized_obligation: { discountPct: 10, actorRole: "sales" },
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^cmt-/);
    expect(result.data).toMatchObject({ type: "discount_offer", extracted: expect.any(String) });
  });

  it("create_commitment succeeds in demo mode without supabase", async () => {
    const result = await executeTool(
      "create_commitment",
      {
        type: "discount_offer",
        extracted_text: "10% off if paid today",
        normalized_obligation: { discountPct: 10 },
        confidence: 0.9,
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^cmt-demo-/);
    expect(result.data).toMatchObject({ type: "discount_offer", confidence: 0.9 });
  });

  it("route_approval produces a pending approval id in demo mode", async () => {
    const result = await executeTool(
      "route_approval",
      { commitment_ref: "cmt-demo-1", required_role: "admin", reason: "discount exceeds 5%" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^approval-demo-/);
    expect(result.decision).toBe("requires_approval");
  });

  it("build_evidence_pack returns an assembled payload", async () => {
    const result = await executeTool(
      "build_evidence_pack",
      {
        commitment_ref: "cmt-demo-1",
        source_messages: ["msg-1", "msg-2"],
        transcript: "Customer asked for 10% off. Sarah agreed.",
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ transcript: expect.any(String) });
  });

  it("write_audit_event returns an id in demo mode", async () => {
    const result = await executeTool(
      "write_audit_event",
      {
        entity_type: "commitment",
        entity_id: "cmt-demo-1",
        event_type: "approve_with_edits",
        payload: { edited_body: "We can confirm 7%" },
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.id).toMatch(/^cmt-demo-1-/);
  });

  it("escalate_stale_commitment returns escalated=true in demo mode", async () => {
    const result = await executeTool(
      "escalate_stale_commitment",
      { commitment_ref: "cmt-demo-1", hours_stale: 8 },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.escalated).toBe(true);
  });
});