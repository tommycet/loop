import Link from "next/link";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/landing", label: "Overview" },
      { href: "/app", label: "Live dashboard" },
      { href: "/docs", label: "Documentation" },
      { href: "/docs/api", label: "API reference" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/about#careers", label: "Careers" },
      { href: "/about#press", label: "Press" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs/guides/getting-started", label: "Getting started" },
      { href: "/docs/guides/integrations", label: "Integrations" },
      { href: "/docs/changelog", label: "Changelog" },
      { href: "/docs/security", label: "Security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/docs/terms", label: "Terms" },
      { href: "/docs/privacy", label: "Privacy" },
      { href: "/docs/cookies", label: "Cookies" },
      { href: "/docs/dpa", label: "DPA" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[color:var(--ink-deep)] border-t border-[color:var(--ink-edge)]">
      <div className="container-page py-20">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-6">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <span className="text-[color:var(--brand-cyan)]">◴</span> Loop
            </div>
            <div className="mt-6 flex items-center gap-3">
              <SocialIcon name="x" />
              <SocialIcon name="github" />
              <SocialIcon name="linkedin" />
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <div className="text-eyebrow mb-4">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[0.875rem] text-fg-tertiary hover:text-fg-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-[color:var(--ink-edge)] pt-8 md:flex-row md:items-center">
          <div className="font-mono text-[0.75rem] text-fg-muted">
            © {new Date().getFullYear()} Loop Operations Labs · v0.1.0
          </div>
          <div className="flex items-center gap-2 font-mono text-[0.75rem] text-fg-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--signal-success)] animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: "x" | "github" | "linkedin" }) {
  const paths: Record<string, JSX.Element> = {
    x: (
      <path d="M18.244 2H21.5l-7.39 8.443L22.75 22h-6.847l-5.36-7.012L4.5 22H1.244l7.91-9.04L1.5 2h7.022l4.85 6.41L18.244 2Zm-1.2 18h1.83L7.05 4H5.094L17.044 20Z" />
    ),
    github: (
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    ),
    linkedin: (
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    ),
  };
  return (
    <a
      href="#"
      aria-label={name}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--ink-edge)] text-fg-tertiary transition-colors hover:border-[color:var(--brand-cyan-soft)] hover:text-fg-primary"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">{paths[name]}</svg>
    </a>
  );
}