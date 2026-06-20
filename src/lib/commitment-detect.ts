import type { CommitmentType, RiskTier, Team } from "../types";
import type { AuthorityRule } from "../types";

/**
 * Try to identify the commitment type from free text. Falls back to follow_up.
 * Used by both the planner and the heuristics-only seed.
 */
export function detectCommitmentType(text: string): CommitmentType {
  const t = text.toLowerCase();
  if (/refund|return money|reverse charge|chargeback/.test(t)) return "refund_request";
  if (/paid|payment sent|transferred|sent rs|sent pkr|sent usd/.test(t)) return "payment_claim";
  if (/\d+\s*%|discount|less on price|reduce by/.test(t)) return "discount_offer";
  if (/(by friday|by saturday|by sunday|by monday|deliver|tomorrow|asap|today)/.test(t)) return "delivery_promise";
  if (/complain|angry|frustrat|again|second time|escalat/.test(t)) return "complaint";
  if (/quote|estimate|proposal|price for|cost for/.test(t)) return "quote_request";
  if (/follow up|remind|check back|nudge/.test(t)) return "follow_up";
  return "follow_up";
}

/**
 * Heuristic numeric signal extraction.
 * Returns best-effort normalized values; planner output is preferred when present.
 */
export interface ExtractedSignals {
  discountPct: number | null;
  deliveryHours: number | null;
  hasScreenshot: boolean;
  stockRisk: boolean;
  isRepeatComplaint: boolean;
}

export function extractSignals(text: string): ExtractedSignals {
  const lower = text.toLowerCase();
  const pct = text.match(/(\d{1,2})\s*%/);
  const days = lower.match(/(\d{1,3})\s*(day|days)/);
  const hours = lower.match(/(\d{1,3})\s*(hour|hours|hr|hrs)/);
  const deliveryHours = days
    ? Number(days[1]) * 24
    : hours
      ? Number(hours[1])
      : null;
  return {
    discountPct: pct ? Number(pct[1]) : null,
    deliveryHours,
    hasScreenshot: /screenshot|image|attach|photo/.test(lower),
    stockRisk: /stock|shortage|out of stock|low stock/.test(lower),
    isRepeatComplaint: /again|second time|third time/.test(lower),
  };
}

/**
 * Resolve the team required for approval based on rule and risk tier.
 * Returns the role required for the human approver.
 */
export function roleForApproval(type: CommitmentType, tier: RiskTier, rules: AuthorityRule[]): Team {
  const rule = rules.find((r) => r.action_type === type);
  if (rule) return rule.required_role as Team;
  if (tier === "blocked") return "finance";
  if (tier === "high") return "admin";
  if (type === "complaint") return "admin";
  if (type === "quote_request") return "sales";
  return "sales";
}