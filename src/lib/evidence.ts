// Evidence pack builder. Pure functions — given a commitment + its
// approval chain + audit trail, produces a self-contained HTML report
// (print-to-PDF from the browser) and a CSV of the audit trail.
// No PDF library dep — keeps the bundle small and works in any browser.

export interface EvidenceCommitment {
  id: string;
  type: string;
  extracted_text: string;
  risk_tier?: string;
  status: string;
  confidence?: number;
  required_role?: string | null;
  created_at: string;
}

export interface EvidenceSourceMessage {
  id: string;
  channel: string;
  content: string;
  external_id?: string;
  contact_id?: string;
  created_at: string;
}

export interface EvidenceApproval {
  id: string;
  required_role: string;
  decision: string;
  decision_reason?: string | null;
  decided_at?: string | null;
  decided_by_role?: string | null;
  created_at: string;
}

export interface EvidenceAuditEvent {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id?: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface EvidenceInput {
  commitment: EvidenceCommitment;
  source_message: EvidenceSourceMessage | null;
  approvals: EvidenceApproval[];
  audit_events: EvidenceAuditEvent[];
}

export interface EvidencePack {
  generated_at: string;
  commitment: EvidenceCommitment;
  source_message: EvidenceSourceMessage | null;
  approvals: EvidenceApproval[];
  audit_events: EvidenceAuditEvent[];
}

export function buildEvidencePack(input: EvidenceInput): EvidencePack {
  return {
    generated_at: new Date().toISOString(),
    commitment: input.commitment,
    source_message: input.source_message,
    approvals: [...input.approvals].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    audit_events: [...input.audit_events].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
  };
}

// Minimal HTML escaping — we render user-supplied message content into the
// report so this needs to be safe.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return s;
  }
}

export function renderEvidenceHTML(pack: EvidencePack): string {
  const c = pack.commitment;
  const m = pack.source_message;

  const approvalRows = pack.approvals
    .map(
      (a) => `<tr>
      <td>${esc(fmtDate(a.created_at))}</td>
      <td>${esc(a.required_role)}</td>
      <td>${esc(a.decision)}</td>
      <td>${esc(a.decision_reason ?? "")}</td>
      <td>${esc(a.decided_by_role ?? "")}</td>
      <td>${a.decided_at ? esc(fmtDate(a.decided_at)) : ""}</td>
    </tr>`
    )
    .join("\n");

  const auditRows = pack.audit_events
    .map(
      (e) => `<tr>
      <td>${esc(fmtDate(e.created_at))}</td>
      <td>${esc(e.event_type)}</td>
      <td>${esc(e.actor_type)}</td>
      <td>${esc(e.actor_id ?? "")}</td>
      <td><pre>${esc(JSON.stringify(e.payload, null, 2))}</pre></td>
    </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Evidence Pack — ${esc(c.id)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 900px; margin: 32px auto; padding: 0 24px; color: #111; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 32px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  pre { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; }
  .quote { background: #fafafa; border-left: 3px solid #10b981; padding: 12px 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
  .badge { display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #ccc; border-radius: 3px; background: #fafafa; }
  .badge.high { background: #fee; border-color: #c33; color: #900; }
  .badge.medium { background: #ffe; border-color: #c93; color: #740; }
  .badge.low { background: #efe; border-color: #393; color: #050; }
  @media print { body { margin: 0; } h2 { page-break-after: avoid; } }
</style>
</head>
<body>
<h1>Evidence Pack — Commitment ${esc(c.id)}</h1>
<div class="meta">
  Generated ${esc(fmtDate(pack.generated_at))} · Loop Commitment Control Plane
</div>

<h2>Commitment</h2>
<table>
  <tr><th style="width: 200px">ID</th><td>${esc(c.id)}</td></tr>
  <tr><th>Type</th><td><span class="badge">${esc(c.type)}</span></td></tr>
  <tr><th>Risk tier</th><td><span class="badge ${esc((c.risk_tier || "low").toLowerCase())}">${esc(c.risk_tier ?? "unknown")}</span></td></tr>
  <tr><th>Status</th><td>${esc(c.status)}</td></tr>
  <tr><th>Required role</th><td>${esc(c.required_role ?? "—")}</td></tr>
  <tr><th>Confidence</th><td>${c.confidence != null ? esc((c.confidence * 100).toFixed(1) + "%") : "—"}</td></tr>
  <tr><th>Created at</th><td>${esc(fmtDate(c.created_at))}</td></tr>
  <tr><th>Extracted text</th><td><div class="quote">${esc(c.extracted_text)}</div></td></tr>
</table>

${
  m
    ? `<h2>Source Message</h2>
<table>
  <tr><th style="width: 200px">Channel</th><td>${esc(m.channel)}</td></tr>
  <tr><th>Message ID</th><td>${esc(m.id)}</td></tr>
  <tr><th>External ID</th><td>${esc(m.external_id ?? "—")}</td></tr>
  <tr><th>Contact ID</th><td>${esc(m.contact_id ?? "—")}</td></tr>
  <tr><th>Sent at</th><td>${esc(fmtDate(m.created_at))}</td></tr>
  <tr><th>Content</th><td><div class="quote">${esc(m.content)}</div></td></tr>
</table>`
    : `<h2>Source Message</h2><p><em>No source message recorded.</em></p>`
}

<h2>Approval Chain</h2>
${
  pack.approvals.length === 0
    ? `<p><em>No approval requests.</em></p>`
    : `<table>
  <tr><th>Requested</th><th>Required role</th><th>Decision</th><th>Reason</th><th>Decided by</th><th>Decided at</th></tr>
  ${approvalRows}
</table>`
}

<h2>Audit Trail</h2>
${
  pack.audit_events.length === 0
    ? `<p><em>No audit events.</em></p>`
    : `<table>
  <tr><th>Timestamp</th><th>Event</th><th>Actor type</th><th>Actor ID</th><th>Payload</th></tr>
  ${auditRows}
</table>`
}

<hr style="margin-top: 48px"/>
<p style="color: #666; font-size: 11px;">
  This evidence pack is generated from immutable audit data. Tampering with this
  document does not alter the underlying record in Loop.
</p>

</body>
</html>`;
}

// RFC 4180 CSV: fields with commas, quotes, or newlines are quoted;
// embedded quotes are doubled.
function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(events: EvidenceAuditEvent[]): string {
  const header = ["event_type", "actor_type", "actor_id", "created_at", "payload"];
  const lines = [header.map(csvEscape).join(",")];
  for (const e of events) {
    lines.push(
      [
        csvEscape(e.event_type),
        csvEscape(e.actor_type),
        csvEscape(e.actor_id ?? ""),
        csvEscape(e.created_at),
        csvEscape(JSON.stringify(e.payload)),
      ].join(",")
    );
  }
  return lines.join("\n");
}