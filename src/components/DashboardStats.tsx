"use client";

import { useEffect, useState } from "react";

export function DashboardStats({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState({
    messages: 0,
    openTasks: 0,
    approvals: 0,
    overdue: 0,
    openCommitments: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) =>
        setStats({
          messages: data.messages ?? 0,
          openTasks: data.openTasks ?? 0,
          approvals: data.approvals ?? 0,
          overdue: data.overdue ?? 0,
          openCommitments: data.openCommitments ?? 0,
          pendingApprovals: data.pendingApprovals ?? 0,
        }),
      )
      .catch(() => setStats({ messages: 0, openTasks: 0, approvals: 0, overdue: 0, openCommitments: 0, pendingApprovals: 0 }));
  }, [refreshKey]);

  const cards = [
    { label: "messages ingested", value: stats.messages, accent: "text-cyan-300" },
    { label: "commitments", value: stats.openCommitments, accent: "text-emerald-300" },
    { label: "awaiting human", value: stats.pendingApprovals, accent: "text-fuchsia-300" },
    { label: "overdue", value: stats.overdue, accent: "text-rose-300" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur"
        >
          <div className="mb-3 text-[10px] uppercase tracking-[0.32em] text-white/45">{card.label}</div>
          <div className={`text-4xl font-semibold tracking-tight ${card.accent}`}>{card.value}</div>
        </div>
      ))}
    </section>
  );
}