// Daily digest builder. Pure function: snapshot of state in, formatted
// message out. No I/O — the API route fetches state, calls buildDigest,
// then dispatches via Telegram/WhatsApp/email.

export interface DigestInput {
  commitments: Array<{
    id: string;
    summary?: string;
    commitment_type?: string;
    created_at: string;
    status: string;
    risk_tier?: string;
  }>;
  approvalRequests: Array<{
    id: string;
    commitment_summary?: string;
    commitment_id?: string;
    required_role?: string;
    status: string;
    escalated?: boolean;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
  }>;
}

export interface Digest {
  generated_at: string;
  headline: string;
  commitments_needing_attention: string[];
  overdue_count: number;
  tasks_completed_yesterday: number;
  escalations_pending: number;
  // Raw counts for callers that want them.
  counts: {
    pending_approvals: number;
    open_commitments: number;
    overdue: number;
    completed_yesterday: number;
    escalations: number;
  };
}

const OVERDUE_DAYS = 2;

export function buildDigest(input: DigestInput): Digest {
  const now = new Date();
  const cutoff = new Date(now.getTime() - OVERDUE_DAYS * 86_400_000);

  // Pending approvals: list with required role for routing context.
  const pendingApprovals = input.approvalRequests.filter((a) => a.status === "pending");
  const commitmentsList = pendingApprovals.map((a) => {
    const role = a.required_role ? ` (${a.required_role})` : "";
    const overdueTag = a.commitment_id &&
      input.commitments.find((c) => c.id === a.commitment_id && new Date(c.created_at) < cutoff)
      ? " overdue" : "";
    const summary = a.commitment_summary ?? "Unknown commitment";
    return `• ${summary}${role}${overdueTag}`;
  });

  // Overdue commitments: open + older than threshold.
  const overdue = input.commitments.filter(
    (c) => c.status === "open" && new Date(c.created_at) < cutoff
  );
  for (const c of overdue) {
    if (!commitmentsList.some((line) => line.includes(c.summary ?? ""))) {
      commitmentsList.push(`• ${c.summary ?? "Open commitment"} overdue`);
    }
  }

  // Tasks completed in last 24h.
  const dayAgo = now.getTime() - 24 * 3_600_000;
  const completedYesterday = input.tasks.filter(
    (t) => t.status === "completed" && new Date(t.updated_at).getTime() >= dayAgo
  );

  // Escalations.
  const escalations = input.approvalRequests.filter((a) => a.status === "pending" && a.escalated);

  const openCommitments = input.commitments.filter((c) => c.status === "open");

  // Headline.
  let headline: string;
  if (commitmentsList.length === 0 && escalations.length === 0) {
    headline = `Loop Daily Digest — ${now.toLocaleDateString()} — all clear.`;
  } else {
    headline = `Loop Daily Digest — ${now.toLocaleDateString()}`;
  }

  return {
    generated_at: now.toISOString(),
    headline,
    commitments_needing_attention: commitmentsList,
    overdue_count: overdue.length,
    tasks_completed_yesterday: completedYesterday.length,
    escalations_pending: escalations.length,
    counts: {
      pending_approvals: pendingApprovals.length,
      open_commitments: openCommitments.length,
      overdue: overdue.length,
      completed_yesterday: completedYesterday.length,
      escalations: escalations.length,
    },
  };
}

// Format the digest as a plain-text message suitable for Telegram or
// WhatsApp (no Markdown — both platforms interpret * and _ differently).
export function formatDigestForTelegram(d: Digest): string {
  const lines: string[] = [];
  lines.push(d.headline);
  lines.push("");

  if (d.commitments_needing_attention.length === 0) {
    lines.push("No commitments need attention today.");
  } else {
    lines.push(`${d.commitments_needing_attention.length} commitment(s) need attention:`);
    lines.push(...d.commitments_needing_attention.slice(0, 10));
    if (d.commitments_needing_attention.length > 10) {
      lines.push(`...and ${d.commitments_needing_attention.length - 10} more.`);
    }
  }

  lines.push("");
  if (d.overdue_count > 0) {
    lines.push(`${d.overdue_count} overdue.`);
  }
  if (d.escalations_pending > 0) {
    lines.push(`${d.escalations_pending} escalation(s) pending.`);
  }
  if (d.tasks_completed_yesterday > 0) {
    lines.push(`${d.tasks_completed_yesterday} task(s) completed yesterday.`);
  } else {
    lines.push("0 tasks completed yesterday.");
  }

  lines.push("");
  lines.push("Reply with any commitment ID to see details.");

  return lines.join("\n");
}