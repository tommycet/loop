/**
 * Shared inline detection for all channel webhooks.
 *
 * Both Telegram and WhatsApp (Meta / Wappfly) webhooks call this after
 * persisting a new message so the authority queue updates within
 * milliseconds — not after the Inngest debounce. Best-effort: any
 * failure is logged but doesn't fail the webhook (the Inngest consumer
 * will pick it up later).
 *
 * Only operates in demo-state mode; in Supabase mode the Inngest
 * `classifyAndDebounce` function handles batched detection.
 */

import type { ProcessableMessage } from "./process-message";
import { detectAndCreateCommitment } from "./process-message";
import { readDemoState, writeDemoState } from "../demo-state";

/**
 * Run inline detection on a freshly-stored demo-state message. Returns
 * `true` if a commitment was created (so callers can surface it in
 * the response), `false` if skipped or already-detected.
 */
export function runInlineDetectionDemo(
  messageId: string,
  contactName: string | null,
): boolean {
  const state = readDemoState();
  const stored = state.messages.find((m) => m.id === messageId);
  if (!stored || !stored.content || stored.content.trim().length === 0) return false;
  if ((stored as { is_voice_note?: boolean }).is_voice_note) return false;

  const processable: ProcessableMessage = {
    id: stored.id,
    channel: stored.channel,
    contactName,
    content: stored.content,
    createdAt: stored.created_at,
    flaggedAsNoise: stored.status === "noise",
  };

  let created = false;
  try {
    const result = detectAndCreateCommitment(processable);
    if (result.action === "created") {
      const latest = readDemoState();
      latest.commitments = latest.commitments.filter((c) => c.id !== result.commitment.id);
      latest.commitments.unshift(result.commitment);
      if (result.approval) {
        latest.approvalRequests = latest.approvalRequests.filter(
          (a) => a.id !== result.approval!.id,
        );
        latest.approvalRequests.unshift(result.approval);
      }
      latest.auditEvents = [
        {
          id: `audit-${Date.now()}`,
          entity_type: "commitment" as const,
          entity_id: result.commitment.id,
          event_type: result.audit.event_type,
          actor_type: "ai" as const,
          payload: result.audit.payload as Record<string, unknown>,
          created_at: new Date().toISOString(),
        },
        ...latest.auditEvents,
      ];
      const target = latest.messages.find((m) => m.id === stored.id);
      if (target) target.status = "extracted";
      writeDemoState(latest);
      created = true;
    }
  } catch (e) {
    console.warn("[inline-detection] failed:", e);
  }
  return created;
}