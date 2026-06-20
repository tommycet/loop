// Tests for the Slack channel parser. Parses the JSON payload that
// Slack sends to an Events API webhook. Handles URL verification
// handshakes, message events, and skips bot messages.
import { describe, it, expect } from "vitest";
import {
  parseSlackEventPayload,
  extractInboundFromSlack,
  isValidSlackSigningSecret,
} from "@/lib/channels/slack";

describe("parseSlackEventPayload", () => {
  it("parses a basic message event", () => {
    const payload = {
      type: "event_callback",
      event: {
        type: "message",
        channel: "D01234",
        user: "U_BOB",
        text: "I can offer 25% off if Ahmed pays today",
        ts: "1700000000.000100",
        channel_type: "im",
      },
      team_id: "T12345",
    };
    const parsed = parseSlackEventPayload(payload);
    expect(parsed.type).toBe("message");
    expect(parsed.user).toBe("U_BOB");
    expect(parsed.text).toContain("25% off");
    expect(parsed.ts).toBe("1700000000.000100");
    expect(parsed.channel_id).toBe("D01234");
  });

  it("returns type=null for URL verification challenges", () => {
    const payload = { type: "url_verification", challenge: "test-challenge-token", token: "..." };
    const parsed = parseSlackEventPayload(payload);
    expect(parsed.challenge).toBe("test-challenge-token");
    expect(parsed.type).toBe(null);
  });

  it("returns nulls for unknown event types", () => {
    const payload = { type: "event_callback", event: { type: "reaction_added", user: "U_X" } };
    const parsed = parseSlackEventPayload(payload);
    expect(parsed.type).toBe(null);
  });
});

describe("extractInboundFromSlack", () => {
  it("returns a normalized inbound message for a message event", () => {
    const payload = {
      type: "event_callback",
      event: {
        type: "message",
        channel: "D01234",
        user: "U_BOB",
        text: "I can offer Ahmed 25% off if he confirms today",
        ts: "1700000000.000100",
      },
    };
    const inbound = extractInboundFromSlack(payload);
    expect(inbound.channel).toBe("slack");
    expect(inbound.content).toContain("25% off");
    expect(inbound.external_id).toBe("slack:1700000000.000100");
    expect(inbound.contact_handle).toBe("U_BOB");
  });

  it("returns null for non-message events", () => {
    const inbound = extractInboundFromSlack({
      type: "event_callback",
      event: { type: "reaction_added", user: "U_X" },
    });
    expect(inbound).toBeNull();
  });

  it("returns null for bot messages (subtype=bot_message)", () => {
    const inbound = extractInboundFromSlack({
      type: "event_callback",
      event: {
        type: "message",
        subtype: "bot_message",
        channel: "D01234",
        bot_id: "B123",
        text: "I'm a bot",
        ts: "1700000001.000100",
      },
    });
    expect(inbound).toBeNull();
  });
});

describe("isValidSlackSigningSecret", () => {
  it("rejects when no secret configured", () => {
    expect(isValidSlackSigningSecret(undefined, "v0=abc")).toBe(false);
  });

  it("rejects when signature missing", () => {
    expect(isValidSlackSigningSecret("configured", undefined)).toBe(false);
  });

  it("rejects when signature format is invalid", () => {
    expect(isValidSlackSigningSecret("secret", "no-version-prefix")).toBe(false);
  });

  it("rejects when signature does not match computed HMAC", () => {
    expect(isValidSlackSigningSecret("secret", "v0=deadbeef")).toBe(false);
  });
});