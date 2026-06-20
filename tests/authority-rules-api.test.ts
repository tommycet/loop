// Tests for the authority rule classifier + test-rule endpoint.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-rules-"));
  // Seed an authority rules file in demo state so the test route can find them.
  const stateDir = path.join(tmpDir, ".demo-state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "loop-demo-state.json"),
    JSON.stringify({
      messages: [],
      tasks: [],
      approvals: [],
      contacts: [],
      commitments: [],
      approvalRequests: [],
      auditEvents: [],
      authorityRules: [
        {
          id: "rule-discount-15",
          action_type: "discount_offer",
          required_role: "admin",
          max_auto_threshold_pct: 5,
          fail_mode: "block",
          description: "Discounts above 5% need admin approval",
          created_at: new Date().toISOString(),
        },
        {
          id: "rule-delivery-ops",
          action_type: "delivery_promise",
          required_role: "operations",
          max_auto_threshold_hours: 24,
          fail_mode: "draft_only",
          description: "Delivery promises beyond 24h need ops sign-off",
          created_at: new Date().toISOString(),
        },
        {
          id: "rule-complaint-admin",
          action_type: "complaint",
          required_role: "admin",
          fail_mode: "escalate",
          description: "All complaints go to admin",
          created_at: new Date().toISOString(),
        },
      ],
    })
  );
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir("/root/loop");
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe("authority rules test endpoint", () => {
  it("classifies a discount message and returns the matching rule", async () => {
    const { POST } = await import("@/app/api/authority-rules/test/route");
    const req = new Request("http://localhost/api/authority-rules/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "I'll give you 20% off" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detected.type).toBe("discount_offer");
    expect(data.detected.discount_pct).toBe(20);
    expect(data.rules.length).toBeGreaterThan(0);
    expect(data.suggested_role).toBe("admin");
  });

  it("classifies a delivery promise and matches the ops rule", async () => {
    const { POST } = await import("@/app/api/authority-rules/test/route");
    const req = new Request("http://localhost/api/authority-rules/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Will deliver by Friday for sure" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const data = await res.json();
    expect(data.detected.type).toBe("delivery_promise");
    expect(data.suggested_role).toBe("operations");
  });

  it("classifies a complaint and matches the admin escalation rule", async () => {
    const { POST } = await import("@/app/api/authority-rules/test/route");
    const req = new Request("http://localhost/api/authority-rules/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "This is the third time I'm complaining" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const data = await res.json();
    expect(data.detected.type).toBe("complaint");
    expect(data.suggested_role).toBe("admin");
  });

  it("rejects missing message with 400", async () => {
    const { POST } = await import("@/app/api/authority-rules/test/route");
    const req = new Request("http://localhost/api/authority-rules/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns suggested_role=operations when no rule matches", async () => {
    const { POST } = await import("@/app/api/authority-rules/test/route");
    const req = new Request("http://localhost/api/authority-rules/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "thanks!" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const data = await res.json();
    expect(data.rules.length).toBe(0);
    expect(data.suggested_role).toBe("operations");
  });
});

describe("authority rules PUT handler", () => {
  it("updates an existing rule in demo state", async () => {
    const { PUT } = await import("@/app/api/authority-rules/route");
    const req = new Request("http://localhost/api/authority-rules", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "rule-discount-15",
        max_auto_threshold_pct: 10, // bumped from 5
        description: "Discounts above 10% need admin approval",
      }),
    });
    const res = await PUT(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rule.max_auto_threshold_pct).toBe(10);
    expect(data.rule.description).toContain("10%");
    // id and created_at preserved
    expect(data.rule.id).toBe("rule-discount-15");
    expect(data.rule.created_at).toBeTruthy();
  });

  it("returns 404 when id is unknown", async () => {
    const { PUT } = await import("@/app/api/authority-rules/route");
    const req = new Request("http://localhost/api/authority-rules", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "no-such-rule", description: "x" }),
    });
    const res = await PUT(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id is missing", async () => {
    const { PUT } = await import("@/app/api/authority-rules/route");
    const req = new Request("http://localhost/api/authority-rules", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "no id" }),
    });
    const res = await PUT(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});