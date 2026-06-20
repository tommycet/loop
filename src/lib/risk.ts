import type { CommitmentType, RiskTier, Team } from "../types";

export type CommitmentSignal = {
  discountPct?: number;
  deliveryHours?: number;
  actorRole?: Team | "customer" | "unknown";
  hasScreenshot?: boolean;
  stockRisk?: boolean;
  isRepeatComplaint?: boolean;
  touchesMoney?: boolean;
  touchesReputation?: boolean;
};

export type RiskInput = {
  type: CommitmentType;
  text: string;
  normalizedOblligation?: unknown;
  normalizedObbligation?: CommitmentSignal | null;
};

/**
 * Risk classifier for the Commitment Control Plane.
 *
 * Returns the highest risk tier implied by the combination of
 * commitment type, normalized signal, and message text.
 */
export function classifyRisk(input: RiskInput): RiskTier {
  const normalized = (input.normalizedObbligation ?? null) as CommitmentSignal | null;
  const text = (input.text ?? "").toLowerCase();

  // Refunds and money reversal are always blocked — require finance.
  if (input.type === "refund_request") return "blocked";

  // Payment claims without an actual screenshot/receipt are blocked.
  if (input.type === "payment_claim") {
    if (normalized && normalized.hasScreenshot === true) return "low";
    return "blocked";
  }

  // Repeated complaints, escalation language, or stock risk => high.
  if (input.type === "complaint") {
    if (normalized?.isRepeatComplaint) return "high";
    if (/again|second time|escalat|complain|angry|frustrat/i.test(text)) return "high";
    return "medium";
  }

  // Discounts: above 5% or implied by large numbers => high; otherwise scaled.
  if (input.type === "discount_offer") {
    const pct = normalized?.discountPct ?? parsePercent(text);
    if (pct === null) return "medium";
    if (pct >= 10) return "high";
    if (pct >= 5) return "medium";
    return "low";
  }

  // Delivery promises: beyond 24h, weekend, or stock risk => high.
  if (input.type === "delivery_promise") {
    const hours = normalized?.deliveryHours ?? parseHours(text);
    if (normalized?.stockRisk) return "high";
    if (hours !== null && hours > 48) return "high";
    if (hours !== null && hours > 24) return "medium";
    return "low";
  }

  // Quote requests with money amounts => high for review.
  if (input.type === "quote_request") {
    if (/\$|rs|pkr|usd|inr|aed|amount|total|price/i.test(text)) return "high";
    return "medium";
  }

  // Generic follow-ups and internal tasks: medium unless something forces it up.
  if (input.type === "follow_up") return "medium";
  if (input.type === "internal_task") return "medium";

  return "low";
}

function parsePercent(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*%/);
  return m ? Number(m[1]) : null;
}

function parseHours(text: string): number | null {
  const days = text.match(/(\d{1,3})\s*(day|days)/);
  if (days) return Number(days[1]) * 24;
  const hours = text.match(/(\d{1,3})\s*(hour|hours|hr|hrs)/);
  if (hours) return Number(hours[1]);
  if (/(today|now|asap|immediately)/.test(text)) return 0;
  if (/(tomorrow|morning)/.test(text)) return 24;
  if (/(weekend|by friday|by saturday|by sunday)/.test(text)) return 72;
  return null;
}