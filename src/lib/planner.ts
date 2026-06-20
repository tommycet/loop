import type { ToolCall } from "../types";
import { getGroq } from "./groq";
import { getOpenRouter } from "./openrouter";
import { executeTool, resolveRefs, type ToolContext, type ToolResult } from "./tools";

export interface PlannerInput {
  messageBatch: { content?: string | null }[];
  contact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  recentMessages: { content?: string | null }[];
  openTasks: { title: string; status: string }[];
  teamMembers: { id: string; name: string; team: string }[];
}

function buildPlannerPrompt(input: PlannerInput): string {
  return `You are Loop, the Commitment Control Plane for a small chat-first business.

Your job: detect informal business commitments (offers, promises, payment claims, complaints) in incoming WhatsApp/email/voice, classify their risk, and decide what to do — auto-execute, draft for human approval, or escalate.

Current messages:
${input.messageBatch.map((m) => `- ${m.content || "[audio]"}`).join("\n")}

Contact: ${input.contact?.name || "Unknown"}

Recent context:
${input.recentMessages.map((m) => `- ${m.content}`).join("\n") || "None"}

Open tasks:
${input.openTasks.map((t) => `- [${t.status}] ${t.title}`).join("\n") || "None"}

Team:
${input.teamMembers.map((m) => `- ${m.name} (${m.team})`).join("\n")}

Available tools:
- detect_commitment(type, extracted_text, normalized_obligation{discountPct?, deliveryHours?, hasScreenshot?, stockRisk?, isRepeatComplaint?, actorRole?})
- classify_risk(commitment_ref) -> risk_tier: low|medium|high|blocked
- create_commitment(type, extracted_text, normalized_obligation, confidence) -> { commitment_ref, risk_tier, required_role }
- route_approval(commitment_ref, required_role, reason) -> { approval_ref, decision: auto_execute|requires_approval|draft_only }
- build_evidence_pack(commitment_ref, source_messages[], transcript)
- execute_approved_action(approval_ref)  // only after human approval
- write_audit_event(entity_type, entity_id, event_type, payload)
- escalate_stale_commitment(commitment_ref, hours_stale)
- create_task, assign_owner, schedule_followup, draft_message, link_to_contact, ignore, ask_human

Rules:
- Every customer-facing money/discount/refund/payment claim MUST go through detect_commitment + classify_risk + create_commitment + route_approval. Do NOT auto-execute.
- Use refs: create_commitment with ref "cmt_1", then route_approval with args { "commitment_ref": "cmt_1" }.
- evidence_pack should include the original customer message, the actor, and any conflict (stock vs promise, payment vs no screenshot).
- If risk is blocked, set required_role to finance/admin and never auto-execute.
- Plain acknowledgements or task follow-ups can still use the legacy create_task path.

Return JSON: { "plan": [{ "ref": "...", "tool": "...", "args": {} }] }`;
}

function parsePlan(content: string): ToolCall[] {
  const parsed = JSON.parse(content);
  return Array.isArray(parsed.plan) ? parsed.plan : [];
}

export async function planActions(input: PlannerInput): Promise<ToolCall[]> {
  const prompt = buildPlannerPrompt(input);
  try {
    const response = await getGroq().chat.completions.create({
      model: process.env.GROQ_PLANNER_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });
    return parsePlan(response.choices[0]?.message?.content || "{}");
  } catch {
    const response = await getOpenRouter().chat.completions.create({
      model: process.env.OPENROUTER_FALLBACK_MODEL || "qwen/qwen-2.5-72b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });
    return parsePlan(response.choices[0]?.message?.content || "{}");
  }
}

export async function executePlan(plan: ToolCall[], ctx: ToolContext): Promise<{ results: ToolResult[]; refs: Map<string, string> }> {
  const refs = new Map<string, string>();
  const results: ToolResult[] = [];

  for (const call of plan) {
    const resolvedCall = resolveRefs(call, refs);
    const result = await executeTool(resolvedCall.tool, resolvedCall.args, ctx);
    if (call.ref && result.id) {
      refs.set(call.ref, result.id);
    }
    results.push(result);
  }

  return { results, refs };
}


// Demo mode plan executor - works without Supabase
export function executePlanDemo(plan: ToolCall[], ctx: { messageId?: string; contactId?: string; teamMembers: { id: string; name: string; team: string }[] }) {
  const refs = new Map<string, string>();
  const results: any[] = [];
  
  for (const action of plan) {
    if (action.ref) refs.set(action.ref, `${action.tool}-${results.length}`);
    results.push({ tool: action.tool, args: action.args, ref: action.ref });
  }
  
  return { results, refs };
}
