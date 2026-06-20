"use client";

import { useEffect, useState } from "react";

type AuthorityRule = {
  id: string;
  action_type: string;
  required_role: string;
  max_auto_threshold_pct?: number | null;
  max_auto_threshold_hours?: number | null;
  fail_mode: string;
  description?: string | null;
  created_at: string;
};

const FAIL_TONE: Record<string, string> = {
  block: "border-rose-300/30 text-rose-200",
  draft_only: "border-amber-300/30 text-amber-200",
  escalate: "border-fuchsia-300/30 text-fuchsia-200",
};

export function AuthorityRulesTable({ refreshKey }: { refreshKey: number }) {
  const [rules, setRules] = useState<AuthorityRule[]>([]);

  useEffect(() => {
    fetch("/api/authority-rules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRules(Array.isArray(d) ? d : []))
      .catch(() => setRules([]));
  }, [refreshKey]);

  return (
    <section className="rounded-[2rem] border border-fuchsia-300/20 bg-[#0c0f17] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-fuchsia-300/70">
            admin · authority rules
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Who can approve what, automatically
          </h2>
          <p className="mt-1 text-sm text-white/55">
            These rules decide whether a commitment auto-executes, drafts for review, or blocks outright.
          </p>
        </div>
        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-fuchsia-200">
          {rules.length} rules
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.18em] text-white/45">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Required role</th>
              <th className="px-4 py-3">Threshold</th>
              <th className="px-4 py-3">Fail mode</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-mono text-xs text-fg-primary">{r.action_type}</td>
                <td className="px-4 py-3 text-white/85">{r.required_role}</td>
                <td className="px-4 py-3 font-mono text-xs text-white/70">
                  {r.max_auto_threshold_pct !== null && r.max_auto_threshold_pct !== undefined
                    ? `≤ ${r.max_auto_threshold_pct}%`
                    : r.max_auto_threshold_hours !== null && r.max_auto_threshold_hours !== undefined
                      ? `≤ ${r.max_auto_threshold_hours}h`
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${FAIL_TONE[r.fail_mode] || "border-white/15 text-white/60"}`}>
                    {r.fail_mode}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/55">{r.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}