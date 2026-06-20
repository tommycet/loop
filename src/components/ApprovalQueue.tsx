"use client";

import { useEffect, useState } from "react";

type Approval = {
  id: string;
  message_draft?: string | null;
  scheduled_at: string;
  escalation_level: number;
  status?: string;
};

export function ApprovalQueue({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Approval[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/approvals", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const approve = async (id: string) => {
    setPendingId(id);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPendingId(null);
    load();
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#120f0f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/70">human checkpoint</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Approvals queue</h2>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/45">
            No approvals waiting. The agent is either quiet or fully processed.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-white/35">
                <span>escalation {item.escalation_level}</span>
                <span>{item.status || "scheduled"}</span>
              </div>
              <p className="mb-4 text-sm leading-6 text-white/85">{item.message_draft || "No draft text available."}</p>
              <button
                className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-50"
                onClick={() => approve(item.id)}
                disabled={pendingId === item.id}
              >
                {pendingId === item.id ? "Approving..." : "Approve and release"}
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
