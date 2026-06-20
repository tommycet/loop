// POST /api/authority-rules/test — given a sample message, return which
// authority rule(s) would match it and what role/threshold would be
// required. Pure logic — no DB writes.
//
// Body: { message: string, channel?: string }
// Returns: { rules: [...matched], suggested_role: string, summary: string }

import { NextRequest, NextResponse } from "next/server";
import { readDemoState } from "../../../../lib/demo-state";
import { safeSupabase } from "../../../../lib/runtime";
import type { AuthorityRule } from "../../../../types";

export const dynamic = "force-dynamic";

interface TestBody {
  message?: string;
  channel?: string;
}

// Lightweight keyword classifier. Mirrors src/lib/commitment-detect.ts
// but only at the rule-evaluation surface (type + threshold).
function classifyMessage(message: string): {
  type: string;
  risk_tier: string;
  discount_pct?: number;
} {
  const lower = message.toLowerCase();
  // Discount detection.
  const discountMatch = lower.match(/(\d{1,2})\s*%/);
  const discount_pct = discountMatch ? parseInt(discountMatch[1], 10) : undefined;
  // Type detection.
  let type = "unknown";
  if (/\b(discount|off|deal|reduced)\b/.test(lower) || discount_pct != null) type = "discount_offer";
  else if (/\b(deliver|ship|will arrive|by friday|by monday|by tomorrow)\b/.test(lower)) type = "delivery_promise";
  else if (/\b(payment|paid|sent|transferred|invoice)\b/.test(lower)) type = "payment_claim";
  else if (/\b(refund|return|money back)\b/.test(lower)) type = "refund_request";
  else if (/\b(complaint|complain|complaining|angry|upset|frustrated)\b/.test(lower)) type = "complaint";
  else if (/\b(quote|price|cost|how much)\b/.test(lower)) type = "quote_request";
  else if (/\b(follow up|followup|callback|reach out)\b/.test(lower)) type = "follow_up";
  // Risk.
  let risk_tier = "low";
  if (discount_pct != null && discount_pct >= 15) risk_tier = "high";
  else if (/\b(tomorrow|friday|monday|asap|urgent|now)\b/.test(lower)) risk_tier = "high";
  else if (discount_pct != null && discount_pct >= 5) risk_tier = "medium";
  return { type, risk_tier, discount_pct };
}

function matchesRule(rule: AuthorityRule, message: string, info: ReturnType<typeof classifyMessage>): boolean {
  if (rule.action_type !== info.type && rule.action_type !== "*") return false;
  if (rule.max_auto_threshold_pct != null && info.discount_pct != null) {
    if (info.discount_pct <= rule.max_auto_threshold_pct) return false; // auto-approved; no rule fire
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TestBody;
    if (!body.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const sb = safeSupabase();
    let rules: AuthorityRule[] = [];
    if (!sb) {
      const state = readDemoState();
      rules = state.authorityRules;
    } else {
      const { data, error } = await sb.from("authority_rules").select("*");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rules = data || [];
    }
    const info = classifyMessage(body.message);
    const matched = rules.filter((r) => matchesRule(r, body.message!, info));
    const suggested_role = matched[0]?.required_role ?? "operations";
    const summary = `${matched.length} rule(s) match "${info.type}" at risk "${info.risk_tier}"${
      info.discount_pct != null ? ` (${info.discount_pct}% discount)` : ""
    }. Suggested role: ${suggested_role}.`;
    return NextResponse.json({
      message: body.message,
      detected: info,
      rules: matched,
      suggested_role,
      summary,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}