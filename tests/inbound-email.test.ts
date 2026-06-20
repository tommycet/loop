// Integration tests for /api/inbound/email. Sets EMAIL_WEBHOOK_SECRET
// in the test process so the auth gate opens.
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.EMAIL_WEBHOOK_SECRET = "test-secret-abc123";
});

describe("email inbound route", () => {
  it("rejects when secret header is missing", async () => {
    const { POST } = await import("@/app/api/inbound/email/route");
    const req = new Request("http://localhost/api/inbound/email", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "From: a@b.com\n\nhi",
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("rejects when secret header is wrong", async () => {
    const { POST } = await import("@/app/api/inbound/email/route");
    const req = new Request("http://localhost/api/inbound/email", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-email-secret": "wrong-secret",
      },
      body: "From: a@b.com\n\nhi",
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("accepts a plain-text email with the correct secret and creates a message + commitment", async () => {
    const { POST } = await import("@/app/api/inbound/email/route");
    const rawEmail = `From: "Ahmed" <ahmed@example.com>
To: sales@loop.test
Subject: 30% off for Ahmed
Date: Mon, 19 Jun 2026 10:00:00 +0000
Message-ID: <test-msg-1@example.com>
Content-Type: text/plain

I can offer Ahmed a 30% discount if he confirms today.`;

    const req = new Request("http://localhost/api/inbound/email", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        "x-email-secret": "test-secret-abc123",
      },
      body: rawEmail,
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.message.channel).toBe("email");
    expect(data.message.content).toContain("30%");
    // Inline detection should fire — discount_offer commitment should be created.
    expect(data.detection).toBe(true);
  });

  it("accepts a JSON envelope payload", async () => {
    const { POST } = await import("@/app/api/inbound/email/route");
    const rawEmail = `From: buyer@example.com
Subject: Quote for 100 laptops
Message-ID: <test-json-1@ex.com>

Please quote 100 laptops delivered to Karachi.`;
    const req = new Request("http://localhost/api/inbound/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-email-secret": "test-secret-abc123",
      },
      body: JSON.stringify({ from: "buyer@example.com", to: "sales@loop.test", raw: rawEmail }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message.channel).toBe("email");
  });

  it("returns 400 when JSON envelope is missing raw field", async () => {
    const { POST } = await import("@/app/api/inbound/email/route");
    const req = new Request("http://localhost/api/inbound/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-email-secret": "test-secret-abc123",
      },
      body: JSON.stringify({ from: "x@y.com" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});