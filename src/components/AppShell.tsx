"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ReactNode } from "react";

import { AppSidebar } from "./AppSidebar";

export function AppShell({
  role,
  children,
  title,
  subtitle,
}: {
  role: string;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-[color:var(--ink-base)] text-fg-primary">
      <AppSidebar role={role} />
      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-fg-tertiary">{subtitle}</p>}
              {pathname && (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
                  {pathname}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/docs"
                className="rounded-full border border-[color:var(--ink-edge)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-fg-tertiary transition hover:border-[color:var(--brand-cyan-soft)] hover:text-fg-primary"
              >
                Docs
              </Link>
              <div className="h-9 w-9 rounded-full bg-[color:var(--brand-cyan-soft)] flex items-center justify-center font-mono text-xs font-semibold uppercase text-[color:var(--brand-cyan)]">
                {role.slice(0, 2)}
              </div>
            </div>
          </div>
        </header>
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}