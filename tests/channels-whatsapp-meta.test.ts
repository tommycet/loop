/**
 * Tests for the Meta Cloud API (direct) webhook normalizer.
 *
 * The existing /api/webhooks/whatsapp uses the Wappfly wrapper which has
 * its own payload shape. Direct Meta Cloud API webhooks deliver a
 * different structure — this normalizer handles that case so admins can
 * connect their own Meta WhatsApp Business App without paying for a BSP.
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { describe, expect, it } from "vitest";

import {
  type MetaWhatsAppWebhook,
  extractInboundMessage as extractMeta,
  parseMetaWebhook,
} from "../src/lib/channels/whatsapp-meta";

describe("parseMetaWebhook", () => {
  it("parses a text message notification", () => {
    const webhook: MetaWhatsAppWebhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15551234567",
                  phone_number_id: "123456",
                },
                contacts: [
                  { profile: { name: "Ahmed" }, wa_id: "923001234567" },
                ],
                messages: [
                  {
                    from: "923001234567",
                    id: "wamid.abc123",
                    timestamp: "1718800000",
                    type: "text",
                    text: { body: "Need 20 chairs by Friday and a discount if I pay today" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const parsed = parseMetaWebhook(webhook);
    expect(parsed.kind).toBe("text");
    if (parsed.kind !== "text") return;
    expect(parsed.fromPhone).toBe("923001234567");
    expect(parsed.fromName).toBe("Ahmed");
    expect(parsed.externalId).toBe("wamid.abc123");
    expect(parsed.content).toBe(
      "Need 20 chairs by Friday and a discount if I pay today",
    );
    expect(parsed.receivedAt).toBe("2024-06-19T12:26:40.000Z");
    expect(parsed.phoneNumberId).toBe("123456");
  });

  it("parses an audio (voice note) notification", () => {
    const webhook: MetaWhatsAppWebhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "15551234567", phone_number_id: "123456" },
                contacts: [{ profile: { name: "Fatima" }, wa_id: "923009876543" }],
                messages: [
                  {
                    from: "923009876543",
                    id: "wamid.audio42",
                    timestamp: "1718800100",
                    type: "audio",
                    audio: {
                      mime_type: "audio/ogg; codecs=opus",
                      sha256: "abcd",
                      id: "media-id-42",
                      voice: true,
                    },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const parsed = parseMetaWebhook(webhook);
    expect(parsed.kind).toBe("audio");
    if (parsed.kind !== "audio") return;
    expect(parsed.externalId).toBe("wamid.audio42");
    expect(parsed.fromName).toBe("Fatima");
    expect(parsed.audioMediaId).toBe("media-id-42");
    expect(parsed.audioMimeType).toBe("audio/ogg; codecs=opus");
    expect(parsed.isVoice).toBe(true);
  });

  it("skips statuses (delivery / read receipts)", () => {
    const webhook: MetaWhatsAppWebhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "15551234567", phone_number_id: "123456" },
                statuses: [
                  {
                    id: "wamid.sent1",
                    status: "delivered",
                    timestamp: "1718800200",
                    recipient_id: "923001234567",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };
    const parsed = parseMetaWebhook(webhook);
    expect(parsed.kind).toBe("skip");
  });

  it("skips when entry has no messages", () => {
    const webhook: MetaWhatsAppWebhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "15551234567", phone_number_id: "123456" },
              },
              field: "messages",
            },
          ],
        },
      ],
    };
    const parsed = parseMetaWebhook(webhook);
    expect(parsed.kind).toBe("skip");
  });

  it("skips unknown message types (image, document) for now", () => {
    const webhook: MetaWhatsAppWebhook = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "biz-1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "15551234567", phone_number_id: "123456" },
                contacts: [{ profile: { name: "x" }, wa_id: "1" }],
                messages: [
                  { from: "1", id: "img1", timestamp: "1", type: "image", image: { id: "i", mime_type: "image/jpeg" } },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };
    const parsed = parseMetaWebhook(webhook);
    expect(parsed.kind).toBe("skip");
  });
});

describe("extractInboundMessage (Meta)", () => {
  it("maps a text message into the RawMessage shape", () => {
    const parsed = {
      kind: "text" as const,
      externalId: "wamid.1",
      fromPhone: "923001234567",
      fromName: "Ahmed",
      content: "hello",
      receivedAt: "2024-06-19T00:00:00.000Z",
      phoneNumberId: "123",
    };
    const raw = extractMeta(parsed, { upsertedContactId: "c-1" });
    expect(raw.external_id).toBe("wamid.1");
    expect(raw.contact_id).toBe("c-1");
    expect(raw.channel).toBe("whatsapp");
    expect(raw.direction).toBe("inbound");
    expect(raw.content).toBe("hello");
    expect(raw.status).toBe("pending");
  });

  it("maps an audio message with audio_media_id in metadata", () => {
    const parsed = {
      kind: "audio" as const,
      externalId: "wamid.2",
      fromPhone: "923001234567",
      fromName: null,
      audioMediaId: "media-2",
      audioMimeType: "audio/ogg",
      receivedAt: "2024-06-19T00:00:00.000Z",
      phoneNumberId: "123",
      isVoice: true,
    };
    const raw = extractMeta(parsed, { upsertedContactId: null });
    expect(raw.is_voice_note).toBe(true);
    expect(raw.metadata).toMatchObject({
      whatsapp_media_id: "media-2",
      whatsapp_mime_type: "audio/ogg",
    });
  });
});