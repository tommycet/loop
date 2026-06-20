"use client";

import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_type: "ai" | "human" | "system";
  actor_id?: string | null;
  actor_role?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const actorTone: Record<string, string> = {
  ai: "border-cyan-300/30 text-cyan-200",
  human: "border-emerald-300/30 text-emerald-200",
  system: "border-white/15 text-white/60",
};

function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "{}";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function AuditLog({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<"all" | "ai" | "human" | "system">("all");

  useEffect(() => {
    fetch("/api/audit", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]));
  }, [refreshKey]);

  const filtered = filter === "all" ? events : events.filter((e) => e.actor_type === filter);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0c0f17] p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/70">audit log</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Every AI and human decision, recorded
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Append-only. Filtered by actor type. Stays 90 days. Exports as CSV.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "ai", "human", "system"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
                filter === f
                  ? "border border-amber-300/40 bg-amber-300/15 text-amber-200"
                  : "border border-white/10 text-white/45 hover:border-white/25"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/45">
          No audit events match this filter.
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered
            .slice()
            .reverse()
            .map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-white/8 bg-black/30 p-3"
              >
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] ${actorTone[event.actor_type] ?? actorTone.system}`}
                >
                  {event.actor_type}
                </span>
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {event.event_type} · {event.entity_type}
                    {event.actor_role && (
                      <span className="ml-2 text-white/30">
                        (by {event.actor_role})
                      </span>
                    )}
                  </div>
                  <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-white/70 [overflow-wrap:anywhere]">
                    {formatPayload(event.payload)}
                  </pre>
                </div>
                <time className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/30">
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
