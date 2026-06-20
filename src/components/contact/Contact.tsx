"use client";

import { useState } from "react";

const CHANNELS = [
  {
    label: "Sales",
    detail: "Buying for a team of 10+? Get a tailored demo.",
    email: "sales@loop.demo",
    responseTime: "Replies within 4h, Mon-Fri",
  },
  {
    label: "Support",
    detail: "Already a customer? Open an in-app ticket for fastest help.",
    email: "support@loop.demo",
    responseTime: "Replies within 24h",
  },
  {
    label: "Press",
    detail: "For interviews, brand assets, and partnership enquiries.",
    email: "press@loop.demo",
    responseTime: "Replies within 48h",
  },
];

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      // Send to the existing /api/reminders/send stub or fire-and-forget to /api/contact
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          company: data.get("company"),
          message: data.get("message"),
        }),
      }).catch(() => null);
    } catch {
      // No-op — show success anyway in demo
    }

    // Simulate send
    await new Promise((r) => setTimeout(r, 800));
    setStatus("sent");
    form.reset();
    window.setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <form onSubmit={onSubmit} className="surface-card p-8 space-y-6" aria-label="Contact form">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name">Your name</label>
          <input id="name" name="name" type="text" required placeholder="Sarah Khan" />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="sarah@biz.pk" />
        </div>
      </div>
      <div>
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" placeholder="Ali Traders" />
      </div>
      <div>
        <label htmlFor="message">What can we help with?</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="We're a 12-person clinic running on WhatsApp. The reception team keeps dropping follow-ups. Want to see a demo."
        />
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-[0.8125rem] text-fg-tertiary">
          We respond within 24h, Mon-Fri. No newsletter signup.
        </p>
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn btn-primary"
        >
          {status === "sending" && "Sending..."}
          {status === "sent" && "Sent ✓"}
          {status === "idle" && "Send message"}
          {status === "error" && "Try again"}
        </button>
      </div>
    </form>
  );
}

export function ContactChannels() {
  return (
    <div className="space-y-4">
      {CHANNELS.map((c) => (
        <div key={c.label} className="surface-card p-6">
          <div className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase text-[color:var(--brand-cyan)] mb-2">
            {c.label}
          </div>
          <p className="text-[0.9375rem] text-fg-secondary leading-relaxed mb-3">{c.detail}</p>
          <a href={`mailto:${c.email}`} className="link font-mono text-[0.875rem]">
            {c.email}
          </a>
          <div className="mt-2 text-[0.75rem] text-fg-tertiary">{c.responseTime}</div>
        </div>
      ))}
    </div>
  );
}