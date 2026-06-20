"use client";

import { useState } from "react";

import { DEMO_PASSWORDS } from "../lib/passwords";

const ROLES = [
  { id: "viewer", label: "Viewer", description: "Public dashboard, read-only." },
  { id: "sales", label: "Sales", description: "Quotes, follow-ups, customer tasks." },
  { id: "operations", label: "Operations", description: "Delivery commitments, stock checks." },
  { id: "finance", label: "Finance", description: "Payment claims, refunds, audit." },
  { id: "admin", label: "Admin", description: "Authority rules, escalations, audit log." },
] as const;

export function GateForm({ presetRole, redirectTo }: { presetRole: string; redirectTo: string }) {
  const [role, setRole] = useState(presetRole);
  const [password, setPassword] = useState(DEMO_PASSWORDS[presetRole] ?? "");

  return (
    <form method="POST" action="/api/gate" className="mt-8 space-y-5">
      <input type="hidden" name="redirect" value={redirectTo} />
      <input type="hidden" name="role" value={role} />

      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-fg-tertiary">
          Choose role
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRole(r.id);
                setPassword(DEMO_PASSWORDS[r.id] ?? "");
              }}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition ${
                role === r.id
                  ? "border-[color:var(--brand-cyan)] bg-[color:var(--brand-cyan-soft)]"
                  : "border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] hover:border-[color:var(--brand-cyan-soft)]"
              }`}
            >
              <span className="text-sm font-semibold text-fg-primary">{r.label}</span>
              <span className="mt-0.5 text-[11px] text-fg-tertiary">{r.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-[10px] uppercase tracking-[0.24em] text-fg-tertiary">
          Demo password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          className="w-full rounded-xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] px-4 py-3 font-mono text-sm text-fg-primary focus:border-[color:var(--brand-cyan)] focus:outline-none"
        />
        <p className="mt-2 text-[11px] text-fg-muted">
          Demo passwords are listed below. Pick a role first; the password field pre-fills with the demo default.
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-[color:var(--brand-cyan)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-base)] transition hover:opacity-90"
      >
        Enter dashboard
      </button>
    </form>
  );
}