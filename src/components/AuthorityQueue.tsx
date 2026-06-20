"use client";

import { useEffect, useState } from "react";

type Approval = {
  approval: {
    id: string;
    commitment_id: string;
    required_role: string;
    proposed_action: Record<string, unknown>;
    expires_at?: string | null;
    decision?: string;
  };
  commitment?: {
    id: string;
    type: string;
    extracted_text: string;
    risk_tier: string;
    normalized_obligation: Record<string, unknown>;
    evidence: Record<string, unknown>;
    required_role?: string | null;
    created_at: string;
  };
};

type MeResponse = {
  role: string | null;
  label: string | null;
  canDecideApprovals: boolean;
};

const riskTone: Record<string, string> = {
  low: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10",
  medium: "text-amber-300 border-amber-300/30 bg-amber-300/10",
  high: "text-rose-300 border-rose-300/30 bg-rose-300/10",
  blocked: "text-fuchsia-300 border-fuchsia-300/30 bg-fuchsia-300/10",
};

/**
 * Whether the current viewer is allowed to decide a specific approval.
 * Server-side enforcement is at /api/approvals/[id]/decide — this is UI only.
 */
function canDecideThis(role: string | null, requiredRole: string): boolean {
  if (!role) return false;
  if (role === "viewer") return false;
  if (role === "admin") return true;
  return role === requiredRole;
}

export function AuthorityQueue({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Approval[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [me, setMe] = useState<MeResponse | null>(null);

  const loadQueue = () => {
    fetch("/api/authority-queue", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  };

  const loadMe = () => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setMe(data))
      .catch(() => setMe({ role: null, label: null, canDecideApprovals: false }));
  };

  useEffect(() => {
    loadQueue();
    loadMe();
  }, [refreshKey]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setPendingId(id);
    const res = await fetch(`/api/approvals/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        edited_action: edits[id]
          ? { type: "send_message", channel: "whatsapp", body: edits[id] }
          : null,
      }),
    });
    setPendingId(null);
    setEdits((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });
    // Surface server-side denials
    if (!res.ok) {
      try {
        const body = await res.json();
        alert(body.message || body.error || `Decision failed (${res.status})`);
      } catch {
        alert(`Decision failed (${res.status})`);
      }
    }
    loadQueue();
  };

  const role = me?.role ?? null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#120f0f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">authority queue</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Commitments awaiting a human</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
            signed in as <span className="text-white/70">{me?.label ?? "—"}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
            {items.length} pending
          </div>
        </div>
      </div>

      {role === "viewer" && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/65">
          You are signed in as <strong className="text-white">Viewer</strong> — read-only role.
          Switch to the role required by a commitment to decide it.{" "}
          <a href="/gate" className="text-cyan-300 underline-offset-2 hover:underline">
            Switch role →
          </a>
        </div>
      )}

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/45">
            No commitments waiting on a human. The agent is fully governed or idle.
          </div>
        ) : (
          items.map(({ approval, commitment }) => {
            const tone = riskTone[commitment?.risk_tier ?? "medium"];
            const evidence = (commitment?.evidence ?? {}) as Record<string, unknown>;
            const transcript = Array.isArray(evidence.transcript)
              ? (evidence.transcript as string[])
              : typeof evidence.transcript === "string"
                ? [evidence.transcript]
                : [];
            const obligation = commitment?.normalized_obligation ?? {};
            const proposed = (approval.proposed_action ?? {}) as Record<string, unknown>;
            const proposedBody = String(proposed.body ?? "");
            const editValue = edits[approval.id] ?? proposedBody;
            const allowed = canDecideThis(role, approval.required_role);
            const denyReason =
              !role
                ? "Sign in to decide."
                : role === "viewer"
                  ? "Viewer cannot decide approvals."
                  : role !== "admin" && role !== approval.required_role
                    ? `Requires ${approval.required_role}; you are ${role}.`
                    : null;
            return (
              <div key={approval.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${tone}`}>
                    {commitment?.risk_tier ?? "unknown"} risk
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-white/35">
                    approver: {approval.required_role}
                  </span>
                </div>

                <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">
                  {String(commitment?.type ?? "commitment").replace("_", " ")}
                </div>
                <p className="mb-4 text-sm leading-6 text-white/85">
                  {commitment?.extracted_text ?? "Commitment text unavailable."}
                </p>

                <div className="mb-4 grid gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-[11px] uppercase tracking-[0.18em] text-white/45">
                  <div className="flex justify-between">
                    <span>actor</span>
                    <span className="text-white/70">{String(obligation.actorRole ?? "unknown")} {obligation.actorName ? `/ ${String(obligation.actorName)}` : ""}</span>
                  </div>
                  {typeof obligation.discountPct === "number" && (
                    <div className="flex justify-between">
                      <span>discount</span>
                      <span className="text-white/70">{obligation.discountPct}%</span>
                    </div>
                  )}
                  {typeof obligation.deliveryHours === "number" && (
                    <div className="flex justify-between">
                      <span>delivery in</span>
                      <span className="text-white/70">{obligation.deliveryHours}h {obligation.stockRisk ? "(stock risk)" : ""}</span>
                    </div>
                  )}
                  {typeof obligation.hasScreenshot === "boolean" && (
                    <div className="flex justify-between">
                      <span>payment proof</span>
                      <span className="text-white/70">{obligation.hasScreenshot ? "screenshot attached" : "no evidence"}</span>
                    </div>
                  )}
                  {obligation.isRepeatComplaint ? (
                    <div className="flex justify-between">
                      <span>history</span>
                      <span className="text-rose-300">repeat complaint</span>
                    </div>
                  ) : null}
                </div>

                {transcript.length > 0 && (
                  <details className="mb-4 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-white/55">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-[0.24em] text-white/45">
                      evidence pack ({transcript.length})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {transcript.map((line, idx) => (
                        <li key={idx} className="leading-relaxed">{line}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <label className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-white/45">
                  proposed outbound
                </label>
                <textarea
                  className="mb-4 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white/85 disabled:opacity-50"
                  rows={3}
                  value={editValue}
                  disabled={!allowed}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [approval.id]: e.target.value }))}
                />

                {denyReason ? (
                  <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.18em]">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-white/45">
                      {denyReason}
                    </span>
                    <a href="/gate" className="text-cyan-300 hover:underline">
                      Switch role →
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => decide(approval.id, "approved")}
                      disabled={pendingId === approval.id}
                      className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50"
                    >
                      {pendingId === approval.id ? "Working..." : "Approve and release"}
                    </button>
                    <button
                      onClick={() => decide(approval.id, "rejected")}
                      disabled={pendingId === approval.id}
                      className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
