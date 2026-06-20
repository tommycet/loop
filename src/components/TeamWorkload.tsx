"use client";

import { useEffect, useState } from "react";

type TeamMember = {
  id: string;
  name: string;
  team: string;
  phone?: string | null;
  email?: string | null;
  taskCount?: number;
  openCount?: number;
  activeCommitmentCount?: number;
};

const TEAM_COLOR: Record<string, string> = {
  sales: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  operations: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  finance: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  admin: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200",
};

export function TeamWorkload({ refreshKey }: { refreshKey: number }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [commitments, setCommitments] = useState<Array<{ required_role?: string | null; status: string }>>([]);

  useEffect(() => {
    fetch("/api/team", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setMembers([]));
    fetch("/api/commitments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCommitments(Array.isArray(d) ? d : []))
      .catch(() => setCommitments([]));
  }, [refreshKey]);

  const grouped: Record<string, TeamMember[]> = {};
  for (const m of members) {
    (grouped[m.team] ||= []).push(m);
  }

  const commitmentsByRole = (role: string) =>
    commitments.filter((c) => c.required_role === role && c.status !== "closed" && c.status !== "executed").length;

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(grouped).map(([team, list]) => (
        <section
          key={team}
          className="rounded-3xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)] p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                TEAM_COLOR[team] || "border-white/15 bg-white/5 text-white/70"
              }`}
            >
              {team}
            </span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
              {commitmentsByRole(team)} open
            </span>
          </div>
          <ul className="space-y-3">
            {list.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] p-4"
              >
                <div className="text-sm font-semibold text-fg-primary">{m.name}</div>
                {m.email && <div className="font-mono text-[10px] text-fg-muted">{m.email}</div>}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="font-mono text-lg font-semibold text-fg-primary">{m.taskCount ?? 0}</div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-fg-muted">jobs</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-semibold text-amber-300">{m.openCount ?? 0}</div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-fg-muted">open</div>
                  </div>
                  <div>
                    <div className="font-mono text-lg font-semibold text-cyan-300">
                      {commitmentsByRole(m.team)}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-fg-muted">queue</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}