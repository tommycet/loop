"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/landing", label: "Product" },
  { href: "/app", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "Company" },
  { href: "/contact", label: "Contact" },
];

export function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <header
      className={`sticky top-0 z-raised w-full transition-[background-color,backdrop-filter,border-color] duration-300 ${
        scrolled
          ? "bg-[oklch(0.13_0.012_250_/_0.72)] backdrop-blur-xl border-b border-[oklch(1_0_0_/_0.06)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/landing" className="group flex items-center gap-2.5 font-display text-[1.0625rem] font-semibold tracking-[-0.02em]">
          <LogoMark />
          <span>Loop</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-[0.875rem] transition-colors ${
                isActive(l.href)
                  ? "text-fg-primary"
                  : "text-fg-tertiary hover:text-fg-primary"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/app" className="btn btn-primary btn-sm">
            Open live demo
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="text-[color:var(--brand-cyan)] transition-transform duration-300 group-hover:rotate-180"
    >
      <path
        d="M21 12a9 9 0 1 1-3.51-7.13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 4v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}