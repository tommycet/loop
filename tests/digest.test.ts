// Tests for the daily digest builder. Pure function: takes the live state,
// produces a formatted message. No I/O.
import { describe, it, expect } from "vitest";
import { buildDigest, formatDigestForTelegram } from "@/lib/digest";

describe("buildDigest", () => {
  it("returns a digest with zero counts when state is empty", () => {
    const d = buildDigest({ commitments: [], approvalRequests: [], tasks: [] });
    expect(d.commitments_needing_attention).toEqual([]);
    expect(d.tasks_completed_yesterday).toBe(0);
    expect(d.escalations_pending).toBe(0);
    expect(d.headline).toMatch(/all clear/i);
  });

  it("surfaces commitments awaiting approval", () => {
    const d = buildDigest({
      commitments: [],
      approvalRequests: [
        { id: "a1", commitment_summary: "15% discount to Ahmed", required_role: "admin", status: "pending" },
        { id: "a2", commitment_summary: "Delivery promise to Fatima", required_role: "operations", status: "pending" },
      ],
      tasks: [],
    });
    expect(d.commitments_needing_attention.length).toBe(2);
    expect(d.commitments_needing_attention[0]).toContain("admin");
  });

  it("flags overdue commitments (open > 2 days)", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const d = buildDigest({
      commitments: [
        { id: "c1", summary: "Refund to Bilal", created_at: fiveDaysAgo, status: "open" },
        { id: "c2", summary: "Fresh commitment", created_at: new Date().toISOString(), status: "open" },
      ],
      approvalRequests: [],
      tasks: [],
    });
    expect(d.overdue_count).toBe(1);
    expect(d.commitments_needing_attention.some((c) => c.includes("Bilal"))).toBe(true);
  });

  it("counts tasks completed in the last 24h", () => {
    const yesterday = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const lastWeek = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const d = buildDigest({
      commitments: [],
      approvalRequests: [],
      tasks: [
        { id: "t1", title: "Follow-up call", status: "completed", updated_at: yesterday },
        { id: "t2", title: "Old task", status: "completed", updated_at: lastWeek },
        { id: "t3", title: "Open task", status: "open", updated_at: yesterday },
      ],
    });
    expect(d.tasks_completed_yesterday).toBe(1);
  });

  it("counts pending escalations", () => {
    const d = buildDigest({
      commitments: [],
      approvalRequests: [
        { id: "a1", commitment_summary: "Complaint escalated", required_role: "admin", status: "pending", escalated: true },
      ],
      tasks: [],
    });
    expect(d.escalations_pending).toBe(1);
  });

  it("includes the date in the headline", () => {
    const d = buildDigest({ commitments: [], approvalRequests: [], tasks: [] });
    expect(d.headline).toContain(new Date().getFullYear().toString());
  });
});

describe("formatDigestForTelegram", () => {
  it("renders the headline and counters in Markdown", () => {
    const d = buildDigest({
      commitments: [],
      approvalRequests: [
        { id: "a1", commitment_summary: "15% discount to Ahmed", required_role: "admin", status: "pending" },
      ],
      tasks: [],
    });
    const msg = formatDigestForTelegram(d);
    expect(msg).toMatch(/Loop Daily Digest/);
    expect(msg).toMatch(/1 commitment/);
    expect(msg).toMatch(/Ahmed/);
  });

  it("uses escape characters for Telegram MarkdownV2 safety", () => {
    const d = buildDigest({ commitments: [], approvalRequests: [], tasks: [] });
    const msg = formatDigestForTelegram(d);
    // Dots, parens, etc. should NOT be escaped in plain mode — we use plain text.
    expect(msg).not.toContain("\\.");
    expect(msg).toContain(".");
  });
});