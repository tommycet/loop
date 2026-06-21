"use client";

import { useEffect, useRef, useState } from "react";

import { DEMO_PASSWORDS } from "../lib/passwords";
import { ROLE_LABEL, type Role } from "../lib/auth-client";

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Public dashboard, read-only.",
  sales: "Quotes, follow-ups, customer tasks.",
  operations: "Delivery commitments, stock checks.",
  finance: "Payment claims, refunds, audit.",
  admin: "Authority rules, escalations, audit log.",
};

const ROLE_ORDER: Role[] = ["admin", "operations", "finance", "sales", "viewer"];

export function RoleMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = role.slice(0, 2).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group flex items-center gap-2 rounded-full border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)] py-1 pl-1 pr-3 text-xs uppercase tracking-[0.18em] text-fg-tertiary transition hover:border-[color:var(--brand-cyan-soft)] hover:text-fg-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--brand-cyan-soft)] font-mono text-[10px] font-semibold text-[color:var(--brand-cyan)]">
          {initials}
        </span>
        <span className="font-mono">{ROLE_LABEL[role]}</span>
        <span
          className={`text-[10px] text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        >
          {/* Current session header */}
          <div className="border-b border-[color:var(--ink-edge)] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
              Signed in as
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand-cyan-soft)] font-mono text-[10px] font-semibold text-[color:var(--brand-cyan)]">
                {initials}
              </span>
              <span className="font-mono text-sm text-fg-primary">
                {ROLE_LABEL[role]}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-fg-tertiary">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {/* Quick switch */}
          <div className="border-b border-[color:var(--ink-edge)] px-2 py-2">
            <div className="px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-fg-muted">
              Switch role
            </div>
            <div className="mt-1 space-y-0.5">
              {ROLE_ORDER.filter((r) => r !== role).map((r) => (
                <form
                  key={r}
                  method="POST"
                  action="/api/gate"
                  className="contents"
                >
                  <input type="hidden" name="role" value={r} />
                  <input
                    type="hidden"
                    name="password"
                    value={DEMO_PASSWORDS[r] ?? ""}
                  />
                  <input type="hidden" name="redirect" value="/app" />
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[color:var(--ink-base)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--ink-edge)] font-mono text-[9px] font-semibold text-fg-secondary">
                        {r.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-fg-primary">
                        {ROLE_LABEL[r]}
                      </span>
                    </span>
                    <span className="text-[10px] text-fg-muted">↩</span>
                  </button>
                </form>
              ))}
            </div>
            <a
              href="/gate?switch=1"
              role="menuitem"
              className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[11px] text-fg-tertiary transition hover:bg-[color:var(--ink-base)] hover:text-fg-primary"
            >
              <span>More options (gate page)</span>
              <span>→</span>
            </a>
          </div>

          {/* Sign out */}
          <form
            method="POST"
            action="/api/auth/signout"
            className="border-t border-[color:var(--ink-edge)] px-2 py-2"
          >
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-rose-400/10"
            >
              <span className="font-mono text-xs text-rose-200">Sign out</span>
              <span className="text-[10px] text-rose-300/70">⏻</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
