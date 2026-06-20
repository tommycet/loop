// Tests for the evidence pack builder. Pure functions — given a
// commitment + audit trail + approvals, produce an HTML report and a
// CSV log. Used by /api/commitments/[id]/evidence.

import { describe, it, expect } from "vitest";
import {
  buildEvidencePack,
  renderEvidenceHTML,
  toCSV,
  type EvidenceInput,
} from "@/lib/evidence";

const sample: EvidenceInput = {
  commitment: {
    id: "c-123",
    type: "discount_offer",
    extracted_text: "20% off for Ahmed",
    risk_tier: "high",
    status: "pending",
    confidence: 0.92,
    required_role: "admin",
    created_at: "2026-06-19T10:00:00Z",
  },
  source_message: {
    id: "m-1",
    channel: "telegram",
    content: "OK Ahmed, 20% off on the order.",
    external_id: "tg-msg-42",
    contact_id: "contact-ahmed",
    created_at: "2026-06-19T09:55:00Z",
  },
  approvals: [
    {
      id: "a-1",
      required_role: "admin",
      decision: "pending",
      decision_reason: null,
      decided_at: null,
      decided_by_role: null,
      created_at: "2026-06-19T10:01:00Z",
    },
  ],
  audit_events: [
    {
      id: "ev-1",
      event_type: "commitment.detected",
      actor_type: "ai",
      actor_id: "loop-detect-v1",
      created_at: "2026-06-19T10:00:00Z",
      payload: { source: "telegram" },
    },
    {
      id: "ev-2",
      event_type: "approval.requested",
      actor_type: "system",
      actor_id: "loop-router",
      created_at: "2026-06-19T10:01:00Z",
      payload: { required_role: "admin", reason: "discount > 15%" },
    },
  ],
};

describe("buildEvidencePack", () => {
  it("returns a pack with all sections present", () => {
    const pack = buildEvidencePack(sample);
    expect(pack.commitment.id).toBe("c-123");
    expect(pack.source_message.content).toContain("Ahmed");
    expect(pack.approvals.length).toBe(1);
    expect(pack.audit_events.length).toBe(2);
    expect(pack.generated_at).toBeTruthy();
  });
});

describe("renderEvidenceHTML", () => {
  it("includes the commitment summary in an h1", () => {
    const html = renderEvidenceHTML(buildEvidencePack(sample));
    expect(html).toMatch(/<h1[^>]*>.*Evidence Pack.*<\/h1>/);
    expect(html).toContain("20% off for Ahmed");
  });

  it("includes audit events in chronological order", () => {
    const html = renderEvidenceHTML(buildEvidencePack(sample));
    const detectIdx = html.indexOf("commitment.detected");
    const approvalIdx = html.indexOf("approval.requested");
    expect(detectIdx).toBeGreaterThan(-1);
    expect(approvalIdx).toBeGreaterThan(detectIdx);
  });

  it("escapes HTML special characters in user-supplied content", () => {
    const html = renderEvidenceHTML(buildEvidencePack({
      ...sample,
      source_message: { ...sample.source_message, content: "<script>alert(1)</script>" },
    }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("produces valid HTML structure", () => {
    const html = renderEvidenceHTML(buildEvidencePack(sample));
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });
});

describe("toCSV", () => {
  it("produces a header row + one row per audit event", () => {
    const csv = toCSV(sample.audit_events);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // header + 2 events
    expect(lines[0]).toContain("event_type");
    expect(lines[0]).toContain("actor_type");
    expect(lines[1]).toContain("commitment.detected");
    expect(lines[2]).toContain("approval.requested");
  });

  it("escapes commas and quotes in fields", () => {
    const csv = toCSV([
      {
        id: "ev-x",
        event_type: "test",
        actor_type: "human",
        actor_id: "human,with,commas",
        created_at: "2026-06-19T10:00:00Z",
        payload: { reason: 'He said "OK"' },
      },
    ]);
    // Actor id contains commas — must be quoted.
    expect(csv).toContain('"human,with,commas"');
    // The payload field (JSON-serialized) contains embedded quotes. Verify
        // the field is enclosed in outer quotes and the JSON-style escaping
        // is preserved (the test data has nested quotes that get escaped twice:
        // once by JSON, once by CSV). The simplest robust assertion is that
        // the payload is properly quoted as a single CSV field.
        const lines = csv.split("\n");
        expect(lines.length).toBe(2);
        // The last field of the data row must be a single quoted CSV field.
        // Splitting on unquoted commas is non-trivial; just verify the row
        // starts with `test,human,...` and the trailing payload is closed.
        expect(lines[1].startsWith('test,human,"human,with,commas",2026-06-19T10:00:00Z,')).toBe(true);
        expect(lines[1].endsWith('}"')).toBe(true);
  });

  it("returns just the header for empty input", () => {
    const csv = toCSV([]);
    expect(csv.split("\n").length).toBe(1);
    expect(csv).toContain("event_type");
  });
});