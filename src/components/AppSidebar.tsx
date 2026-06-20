"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clearRoleCookieClient } from "../lib/auth-client";
import type { Role } from "../lib/auth-types";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  roles: ReadonlyArray<Role>;
  badge?: string;
};

const NAV: NavItem[] = [
  {
    href: "/app",
    label: "Overview",
    description: "Live counters and recent activity",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
  {
    href: "/app/authority",
    label: "Authority queue",
    description: "Commitments awaiting your sign-off",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
    badge: "live",
  },
  {
    href: "/app/flows",
    label: "Flows",
    description: "Visual automation for commitment routing",
    roles: ["admin", "operations"],
    badge: "new",
  },
  {
    href: "/app/commitments",
    label: "Commitment ledger",
    description: "Every promise made in chat, ranked",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
  {
    href: "/app/jobs",
    label: "Jobs board",
    description: "Tasks and follow-ups for the team",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
  {
    href: "/app/contacts",
    label: "Contacts",
    description: "Customers, timelines, conversation history",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
  {
    href: "/app/team",
    label: "Team workload",
    description: "Owners and open loops per role",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
  {
    href: "/app/audit",
    label: "Audit log",
    description: "Who approved what, when, why",
    roles: ["viewer", "finance", "admin"],
    badge: "audit",
  },
  {
    href: "/app/admin",
    label: "Admin console",
    description: "Authority rules, governance, override",
    roles: ["admin"],
    badge: "admin",
  },
  {
    href: "/app/settings",
    label: "Settings",
    description: "Workspace, integrations, account",
    roles: ["viewer", "sales", "operations", "finance", "admin"],
  },
];

export function AppSidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const visible = NAV.filter((item) => item.roles.includes(role as Role));

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)] lg:flex">
      <div className="border-b border-[color:var(--ink-edge)] p-6">
        <Link href="/app" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.02em]">
          <span className="text-[color:var(--brand-cyan)]">◴</span>
          Loop
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="badge badge-cyan">Commitment Control Plane</span>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] px-3 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-fg-tertiary">Signed in as</div>
            <div className="text-sm font-semibold capitalize text-fg-primary">{role}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearRoleCookieClient();
              fetch("/api/gate", { method: "DELETE" })
                .then(() => {
                  window.location.href = "/gate";
                })
                .catch(() => {
                  window.location.href = "/gate";
                });
            }}
            className="rounded-full border border-[color:var(--ink-edge)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-fg-tertiary transition hover:border-[color:var(--brand-cyan-soft)] hover:text-fg-primary"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {visible.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                    active
                      ? "border-[color:var(--brand-cyan)] bg-[color:var(--brand-cyan-soft)]"
                      : "border-transparent hover:border-[color:var(--ink-edge)] hover:bg-[color:var(--ink-base)]"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          active ? "text-fg-primary" : "text-fg-secondary group-hover:text-fg-primary"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] ${
                            item.badge === "admin"
                              ? "border border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200"
                              : item.badge === "audit"
                                ? "border border-amber-300/30 bg-amber-300/10 text-amber-200"
                                : "border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div className="mt-0.5 text-[11px] text-fg-tertiary">{item.description}</div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[color:var(--ink-edge)] p-4">
        <Link
          href="/landing"
          className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-edge)] px-3 py-2 text-xs text-fg-tertiary transition hover:border-[color:var(--brand-cyan-soft)] hover:text-fg-primary"
        >
          <span>←</span> Back to marketing site
        </Link>
      </div>
    </aside>
  );
}