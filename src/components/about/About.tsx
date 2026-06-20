const VALUES = [
  {
    title: "Operators first",
    detail:
      "We build for the person whose phone buzzes at 11pm. The dashboard has to be fast on 3G, the UI has to be readable in a warehouse. Pretty is not the brief.",
  },
  {
    title: "Receipts over vibes",
    detail:
      "Every action Loop takes is logged. Every draft is reviewable. Every nudge is explainable. We are not a black box that messages customers on your behalf.",
  },
  {
    title: "Pragmatic AI",
    detail:
      "We use the best model for each job, swap them often, and write the prompts in public. AI is leverage — not magic.",
  },
  {
    title: "Self-host by default",
    detail:
      "The data is yours. The keys are yours. If you want to run Loop on a $5 VPS with your own LLM, the README shows you how in 20 minutes.",
  },
];

const TIMELINE = [
  { date: "Jun 2026", label: "Beta", detail: "Loop v0.1 ships to 12 founding teams in Pakistan." },
  { date: "May 2026", label: "First paying team", detail: "Ali Traders becomes design partner #1." },
  { date: "Mar 2026", label: "Hackathon prototype", detail: "Loop wins the Loop AI Build track (Karachi)." },
  { date: "Jan 2026", label: "Founded", detail: "Three engineers, one shared inbox problem." },
];

export function AboutStory() {
  return (
    <>
      <section className="section">
        <div className="container-page">
          <div className="max-w-3xl">
            <div className="text-eyebrow mb-4">About</div>
            <h1 className="text-display-balance">
              We're building the operations layer the{" "}
              <span className="text-[color:var(--brand-cyan)]">chat economy</span> never had.
            </h1>
            <p className="mt-8 text-[1.125rem] text-fg-secondary leading-relaxed">
              Loop started in a Karachi apartment in early 2026, built by three engineers
              who'd spent too many late nights manually chasing WhatsApp threads for
              family businesses. The product is one bet: <strong className="text-fg-primary">the
              same AI that writes emails can run your ops</strong> — if you give it the right shape.
            </p>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container-page">
          <div className="mb-12">
            <h2 className="max-w-2xl text-display-balance">Four lines we will not cross.</h2>
          </div>

          <div className="grid gap-px bg-[color:var(--ink-edge)] sm:grid-cols-2 rounded-xl overflow-hidden border border-[color:var(--ink-edge)]">
            {VALUES.map((v) => (
              <article key={v.title} className="bg-[color:var(--ink-base)] p-8 md:p-10">
                <h3 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-fg-primary mb-3">
                  {v.title}
                </h3>
                <p className="text-[1rem] text-fg-tertiary leading-relaxed">{v.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container-page">
          <div className="mb-12 grid gap-6 md:grid-cols-[1fr_2fr] md:items-end">
            <div>
              <h2 className="text-display-balance">Six months, twelve teams.</h2>
            </div>
            <p className="text-fg-secondary text-[1.0625rem]">
              We ship in months, not years. The roadmap is shaped by the people using
              Loop every day, not by investor decks.
            </p>
          </div>

          <ol className="relative space-y-1 border-l border-[color:var(--ink-edge)] ml-3">
            {TIMELINE.map((t, i) => (
              <li key={t.date} className="relative pl-8 py-5">
                <span className="absolute left-0 top-7 -translate-x-[5px] inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--brand-cyan)]" />
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-mono text-[0.75rem] tracking-[0.12em] uppercase text-fg-muted">
                    {t.date}
                  </span>
                  <span className="text-[1.125rem] font-semibold text-fg-primary">
                    {t.label}
                  </span>
                </div>
                <p className="mt-1.5 text-fg-tertiary text-[0.9375rem] leading-relaxed">
                  {t.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

export function AboutTeam() {
  const team = [
    { name: "T. Cet", role: "Founder / CEO", focus: "Architecture, business model" },
    { name: "S. Iqbal", role: "Co-founder / CTO", focus: "Classification pipeline" },
    { name: "M. Hassan", role: "Head of Design", focus: "Operator-grade UI, motion" },
  ];

  return (
    <section className="section pt-0">
      <div className="container-page">
        <div className="mb-12">
          <h2 className="text-display-balance">Three people, one shared inbox.</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <div key={m.name} className="surface-card p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--brand-cyan-soft)] font-mono text-[0.875rem] font-semibold text-[color:var(--brand-cyan)] mb-5">
                {m.name.split(" ").map((s) => s[0]).join("")}
              </div>
              <div className="text-[1.0625rem] font-semibold text-fg-primary">{m.name}</div>
              <div className="font-mono text-[0.75rem] tracking-[0.12em] uppercase text-fg-tertiary mt-1">
                {m.role}
              </div>
              <p className="mt-3 text-[0.9375rem] text-fg-tertiary leading-relaxed">
                {m.focus}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}