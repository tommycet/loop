"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Getting started",
    items: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/guides/getting-started", label: "Quickstart" },
      { href: "/docs/guides/integrations", label: "Integrations" },
    ],
  },
  {
    title: "Core concepts",
    items: [
      { href: "/docs/concepts/messages", label: "Messages" },
      { href: "/docs/concepts/tasks", label: "Tasks" },
      { href: "/docs/concepts/follow-ups", label: "Follow-ups" },
      { href: "/docs/concepts/escalation", label: "Escalation" },
    ],
  },
  {
    title: "API",
    items: [
      { href: "/docs/api", label: "Overview" },
      { href: "/docs/api/auth", label: "Authentication" },
      { href: "/docs/api/webhooks", label: "Webhooks" },
      { href: "/docs/api/endpoints", label: "Endpoints" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/docs/security", label: "Security" },
      { href: "/docs/self-host", label: "Self-hosting" },
      { href: "/docs/changelog", label: "Changelog" },
    ],
  },
];

export function DocSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto pr-4 lg:block">
      <nav className="space-y-8">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="text-eyebrow mb-3">{g.title}</div>
            <ul className="space-y-1">
              {g.items.map((it) => {
                const isActive = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`block rounded-md px-3 py-1.5 text-[0.875rem] transition-colors ${
                        isActive
                          ? "bg-[color:var(--ink-raised)] text-fg-primary"
                          : "text-fg-tertiary hover:text-fg-primary"
                      }`}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}