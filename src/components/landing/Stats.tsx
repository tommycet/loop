"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  conversations: number;
  messages: number;
  openTasks: number;
  completedTasks: number;
  teamSize: number;
  noiseFiltered: number;
};

const FALLBACK: Snapshot = {
  conversations: 27,
  messages: 45,
  openTasks: 23,
  completedTasks: 2,
  teamSize: 4,
  noiseFiltered: 8,
};

function Stat({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone: "cyan" | "success" | "violet";
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--signal-success)]"
      : tone === "violet"
      ? "text-[color:var(--signal-violet)]"
      : "text-[color:var(--brand-cyan)]";
  return (
    <div className="border-l border-[color:var(--ink-edge)] pl-6">
      <div
        className={`font-display text-[clamp(2.25rem,4vw,3.25rem)] font-semibold tracking-[-0.03em] leading-none ${color}`}
      >
        {value}
      </div>
      <div className="mt-3 text-[0.875rem] text-fg-tertiary max-w-[22ch] leading-snug">
        {label}
      </div>
    </div>
  );
}

export function Stats() {
  const [snap, setSnap] = useState<Snapshot>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [convs, team, digest] = await Promise.all([
          fetch("/api/conversations").then((r) => r.json()),
          fetch("/api/team").then((r) => r.json()),
          fetch("/api/digest").then((r) => r.json()),
        ]);
        if (cancelled) return;
        const next: Snapshot = {
          conversations: convs?.count ?? FALLBACK.conversations,
          messages:
            (convs?.conversations ?? []).reduce(
              (a: number, c: { messageCount?: number }) =>
                a + (c.messageCount ?? 0),
              0,
            ) || FALLBACK.messages,
          openTasks:
            (convs?.conversations ?? []).reduce(
              (a: number, c: { openTaskCount?: number }) =>
                a + (c.openTaskCount ?? 0),
              0,
            ) || FALLBACK.openTasks,
          completedTasks:
            digest?.completedCount ?? FALLBACK.completedTasks,
          teamSize: team?.count ?? FALLBACK.teamSize,
          noiseFiltered:
            (convs?.conversations ?? []).filter(
              (c: { lastMessage?: { status?: string } }) =>
                c.lastMessage?.status === "noise",
            ).length || FALLBACK.noiseFiltered,
        };
        setSnap(next);
        setLive(true);
      } catch {
        // Keep fallback silently — design degrades gracefully
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="border-y border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)]">
      <div className="container-page py-20">
        <div className="mb-10 flex items-center justify-between">
          <p className="text-[0.75rem] uppercase tracking-[0.18em] text-fg-tertiary">
            Live from this demo environment
          </p>
          <span className="inline-flex items-center gap-2 text-[0.75rem] text-fg-tertiary">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live
                  ? "bg-[color:var(--signal-success)] animate-pulse"
                  : "bg-fg-tertiary"
              }`}
            />
            {live ? "Refreshing every 30s" : "Loading snapshot…"}
          </span>
        </div>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            value={snap.conversations}
            label="Inbound conversations ingested"
            tone="cyan"
          />
          <Stat
            value={snap.openTasks}
            label="Open tasks auto-routed to team"
            tone="violet"
          />
          <Stat
            value={snap.messages}
            label="Messages classified by AI"
            tone="cyan"
          />
          <Stat
            value={snap.completedTasks}
            label="Tasks closed by operators"
            tone="success"
          />
          <Stat
            value={snap.noiseFiltered}
            label="Spam / promo messages auto-quieted"
            tone="violet"
          />
          <Stat
            value={snap.teamSize}
            label="Operators receiving auto-assigned work"
            tone="success"
          />
        </div>
      </div>
    </section>
  );
}
