// Tests for the email-channel parser. Cloudflare Email Workers POST a
// JSON-encoded email-address object + raw RFC822 payload to a webhook.
// We parse out: from, to, subject, body, message-id.
import { describe, it, expect } from "vitest";
import {
  parseEmailWorkerPayload,
  extractInboundFromEmail,
  isValidEmailWorkerSecret,
} from "@/lib/channels/email";

describe("parseEmailWorkerPayload", () => {
  it("parses a simple plain-text email", () => {
    const raw = `From: "Ahmed" <ahmed@example.com>
To: sales@loop.test
Subject: Need 20 chairs by Friday
Date: Mon, 19 Jun 2026 10:00:00 +0000
Message-ID: <abc123@example.com>
Content-Type: text/plain; charset=utf-8

Hi, can you deliver 20 office chairs by Friday?

Thanks,
Ahmed`;
    const msg = parseEmailWorkerPayload(raw);
    expect(msg.from).toBe("ahmed@example.com");
    expect(msg.from_name).toBe("Ahmed");
    expect(msg.to).toBe("sales@loop.test");
    expect(msg.subject).toBe("Need 20 chairs by Friday");
    expect(msg.body).toContain("20 office chairs");
    expect(msg.message_id).toBe("<abc123@example.com>");
  });

  it("handles missing optional headers gracefully", () => {
    const raw = `From: foo@bar.com

Just the body.`;
    const msg = parseEmailWorkerPayload(raw);
    expect(msg.from).toBe("foo@bar.com");
    expect(msg.subject).toBe("");
    expect(msg.body).toContain("Just the body");
  });

  it("strips quoted-printable soft line breaks", () => {
    const raw = `From: a@b.com
Subject: Test
Content-Transfer-Encoding: quoted-printable

This is a long line that wraps=
across two lines.`;
    const msg = parseEmailWorkerPayload(raw);
    // Soft line breaks (= at EOL) are stripped entirely: the line continues
    // directly into the next with no separator. So "wraps=\nacross" -> "wrapsacross".
    expect(msg.body).not.toMatch(/=\n/);
    expect(msg.body).not.toMatch(/=\r\n/);
    expect(msg.body).toContain("wrapsacross");
  });
});

describe("extractInboundFromEmail", () => {
  it("returns a normalized inbound message", () => {
    const raw = `From: ahmed@example.com
To: sales@loop.test
Subject: Quote request
Date: Mon, 19 Jun 2026 10:00:00 +0000
Message-ID: <msg-1@ex.com>
Content-Type: text/plain

Please send a quote for 50 desks by next Monday.`;
    const inbound = extractInboundFromEmail(raw, { channelPrefix: "email" });
    expect(inbound.channel).toBe("email");
    expect(inbound.external_id).toBe("<msg-1@ex.com>");
    expect(inbound.content).toContain("50 desks");
    expect(inbound.contact_handle).toBe("ahmed@example.com");
  });

  it("falls back to a synthetic external_id when Message-ID is absent", () => {
    const raw = `From: a@b.com

body`;
    const inbound = extractInboundFromEmail(raw);
    expect(inbound.external_id).toMatch(/^email-synthetic-/);
  });
});

describe("isValidEmailWorkerSecret", () => {
  it("rejects when no secret configured (fail-closed)", () => {
    expect(isValidEmailWorkerSecret(undefined, "anything")).toBe(false);
  });

  it("rejects when provided secret does not match", () => {
    expect(isValidEmailWorkerSecret("configured-secret", "wrong")).toBe(false);
  });

  it("accepts when provided secret matches", () => {
    expect(isValidEmailWorkerSecret("configured-secret", "configured-secret")).toBe(true);
  });

  it("uses constant-time compare to avoid timing leaks", () => {
    // Both short strings — should not throw or return early based on length.
    expect(isValidEmailWorkerSecret("ab", "ab")).toBe(true);
    expect(isValidEmailWorkerSecret("ab", "abc")).toBe(false);
  });
});