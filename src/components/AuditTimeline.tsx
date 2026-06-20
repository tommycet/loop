"use client";

import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_type: string;
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

/**
 * Format a JSON payload for display. Pretty-printed with 2-space indent so
 * each key/value pair lands on its own line and can wrap on its own. Falls
 * back to JSON.stringify(value, null, 2) if payload is missing.
 */
function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "{}";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function AuditTimeline({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const load = () => {
    fetch("/api/audit", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#0c0f17] p-6 text-sm text-white/45">
        No audit events yet. Detect or approve a commitment to see the proof chain.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c0f17] p-6">
      <div className="mb-4 text-[10px] uppercase tracking-[0.32em] text-white/40">audit trail</div>
      <ol className="space-y-3">
        {events.slice(-12).reverse().map((event) => (
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
              {new Date(event.created_at).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
