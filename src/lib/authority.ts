import type { AuthorityRule, CommitmentType, RiskTier, Team } from "../types";

export type AuthorityRequest = {
  actionType: CommitmentType | string;
  riskTier: RiskTier;
  actorRole: Team | "customer" | "unknown";
  discountPct?: number;
  deliveryHours?: number;
  hasEvidence?: boolean;
};

export type AuthorityDecision = {
  decision: "auto_execute" | "requires_approval" | "draft_only";
  required_role: Team | "admin" | null;
  ruleId: string | null;
  reason: string;
  fail_mode: AuthorityRule["fail_mode"];
};

/**
 * Decide whether a proposed commitment action needs human approval,
 * based on authority rules and the risk tier.
 *
 * Blocks (refunds, payment claims without evidence) always require approval.
 * Threshold breaches escalate to the configured required role.
 */
export function resolveAuthority(request: AuthorityRequest, rules: AuthorityRule[]): AuthorityDecision {
  const rule = rules.find((r) => r.action_type === request.actionType);

  // Block-tier risk never auto-executes.
  if (request.riskTier === "blocked") {
    return {
      decision: "requires_approval",
      required_role: rule?.required_role ?? "finance",
      ruleId: rule?.id ?? null,
      reason: rule ? `${request.actionType} blocked by rule ${rule.id}` : `no rule for ${request.actionType}, default to finance block`,
      fail_mode: rule?.fail_mode ?? "block",
    };
  }

  if (!rule) {
    return {
      decision: "requires_approval",
      required_role: "admin",
      ruleId: null,
      reason: `no rule matched ${request.actionType}, fallback to admin block`,
      fail_mode: "block",
    };
  }

  // Discount threshold.
  if (typeof rule.max_auto_threshold_pct === "number") {
    const pct = request.discountPct ?? 0;
    if (pct > rule.max_auto_threshold_pct) {
      return {
        decision: "requires_approval",
        required_role: rule.required_role,
        ruleId: rule.id,
        reason: `discount ${pct}% exceeds auto threshold ${rule.max_auto_threshold_pct}%`,
        fail_mode: rule.fail_mode,
      };
    }
  }

  // Delivery threshold.
  if (typeof rule.max_auto_threshold_hours === "number") {
    const hours = request.deliveryHours ?? 0;
    if (hours > rule.max_auto_threshold_hours) {
      return {
        decision: "requires_approval",
        required_role: rule.required_role,
        ruleId: rule.id,
        reason: `delivery ${hours}h exceeds safe window ${rule.max_auto_threshold_hours}h`,
        fail_mode: rule.fail_mode,
      };
    }
  }

  // High-tier risk still requires approval even within threshold.
  if (request.riskTier === "high") {
    return {
      decision: "requires_approval",
      required_role: rule.required_role,
      ruleId: rule.id,
      reason: `risk tier high on ${request.actionType}`,
      fail_mode: rule.fail_mode,
    };
  }

  return {
    decision: "auto_execute",
    required_role: null,
    ruleId: rule.id,
    reason: `within threshold for ${request.actionType}`,
    fail_mode: rule.fail_mode,
  };
}