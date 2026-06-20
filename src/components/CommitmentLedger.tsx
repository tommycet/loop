"use client";

import { useEffect, useMemo, useState } from "react";

type Commitment = {
  id: string;
  type: string;
  extracted_text: string;
  risk_tier: string;
  status: string;
  required_role?: string | null;
  due_at?: string | null;
  created_at: string;
  normalized_obligation: Record<string, unknown>;
};

const columns: { id: string; label: string; statuses: string[] }[] = [
  { id: "detected", label: "Detected", statuses: ["detected"] },
  { id: "needs_approval", label: "Needs approval", statuses: ["needs_approval"] },
  { id: "approved", label: "Approved / executing", statuses: ["approved", "executed"] },
  { id: "waiting", label: "Waiting customer", statuses: ["escalated", "stale"] },
  { id: "closed", label: "Closed", statuses: ["closed", "rejected"] },
];

const typeLabel: Record<string, string> = {
  discount_offer: "Discount",
  delivery_promise: "Delivery",
  payment_claim: "Payment",
  refund_request: "Refund",
  complaint: "Complaint",
  quote_request: "Quote",
  follow_up: "Follow-up",
  internal_task: "Task",
};

export function CommitmentLedger({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Commitment[]>([]);

  const load = () => {
    fetch("/api/commitments", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const grouped = useMemo(() => {
    return columns.map((column) => ({
      id: column.id,
      label: column.label,
      items: items.filter((c) => column.statuses.includes(c.status)),
    }));
  }, [items]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0c0f17] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/70">commitment ledger</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Every promise made in chat, ranked</h2>
        </div>
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">
          {items.length} commitments
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        {grouped.map((column) => (
          <div key={column.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-white/45">
              <span>{column.label}</span>
              <span>{column.items.length}</span>
            </div>
            <div className="space-y-2">
              {column.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-white/30">
                  empty
                </div>
              ) : (
                column.items.map((commitment) => {
                  const obligation = commitment.normalized_obligation ?? {};
                  const summary =
                    typeof obligation.discountPct === "number"
                      ? `${obligation.discountPct}% discount`
                      : typeof obligation.deliveryHours === "number"
                        ? `${obligation.deliveryHours}h delivery`
                        : obligation.isRepeatComplaint
                          ? "repeat complaint"
                          : String(obligation.actorRole ?? "");
                  return (
                    <div
                      key={commitment.id}
                      className="rounded-xl border border-white/10 bg-black/30 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
                        <span>{typeLabel[commitment.type] ?? commitment.type}</span>
                        <span
                          className={
                            commitment.risk_tier === "high" || commitment.risk_tier === "blocked"
                              ? "text-rose-300"
                              : commitment.risk_tier === "medium"
                                ? "text-amber-300"
                                : "text-emerald-300"
                          }
                        >
                          {commitment.risk_tier}
                        </span>
                      </div>
                      <p className="mb-2 text-[12px] leading-5 text-white/85 line-clamp-3">
                        {commitment.extracted_text}
                      </p>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {summary}
                        {commitment.required_role ? ` · ${commitment.required_role}` : ""}
                      </div>
                      <div className="mt-2 flex gap-2 text-[10px]">
                        <a
                          href={`/api/commitments/${commitment.id}/evidence`}
                          target="_blank"
                          rel="noopener"
                          className="border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 font-mono uppercase tracking-[0.16em] text-emerald-300 hover:border-emerald-600 hover:text-emerald-200"
                          title="Open printable evidence pack"
                        >
                          evidence
                        </a>
                        <a
                          href={`/api/commitments/${commitment.id}/evidence?format=csv`}
                          className="border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono uppercase tracking-[0.16em] text-white/55 hover:border-white/30 hover:text-white"
                          title="Download audit log as CSV"
                        >
                          audit.csv
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}