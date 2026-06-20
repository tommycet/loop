"use client";

import Link from "next/link";
import { HeroBackground } from "./HeroBackground";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackground />

      <div className="container-page pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="max-w-3xl">
          <div className="text-eyebrow text-[color:var(--brand-cyan)] mb-6 flex items-center gap-3">
            <span className="inline-block h-px w-6 bg-[color:var(--brand-cyan)]" />
            Now in beta
          </div>

          <h1 className="text-display-balance text-fg-primary">
            Close the loop on{" "}
            <span className="text-[color:var(--brand-cyan)]">every commitment</span>{" "}
            your team makes in chat.
          </h1>

          <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-fg-secondary">
            Loop watches WhatsApp, email, and voice. It detects every promise, offer,
            and follow-up that humans make in chat, risk-grades it, routes risky actions
            to the right approver with an evidence pack, and proves whether the
            commitment was approved, executed, or escalated. Nothing ships without
            authority.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn btn-primary btn-lg">
              Open the live demo
              <ArrowRight />
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Read the docs
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.8125rem] text-fg-tertiary font-mono">
            <span className="flex items-center gap-2">
              <Check />
              Append-only audit trail
            </span>
            <span className="flex items-center gap-2">
              <Check />
              Authority rules per action type
            </span>
            <span className="flex items-center gap-2">
              <Check />
              Self-host or cloud
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--brand-cyan)]">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}