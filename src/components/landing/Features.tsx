type Feature = {
  title: string;
  detail: string;
  meta: string;
  icon: JSX.Element;
};

const FEATURES: Feature[] = [
  {
    title: "Message intelligence",
    detail:
      "Triage every incoming WhatsApp, email, and voice note. Filter the noise, escalate the urgent, surface the committed.",
    meta: "groq · llama-3.3-70b",
    icon: <IconBrain />,
  },
  {
    title: "Workflow drafting",
    detail:
      "Loop doesn't auto-send. It drafts the reply, assigns the task, sets the deadline — and waits for your team's nod.",
    meta: "human-in-the-loop",
    icon: <IconDraft />,
  },
  {
    title: "SLA pressure",
    detail:
      "Tasks have owners and clocks. If a loop isn't closed in time, the system nudges — and after 3 nudges, escalates.",
    meta: "3-strike escalation",
    icon: <IconClock />,
  },
  {
    title: "Owner routing",
    detail:
      "Routes by skill, current workload, or timezone. Sales get sales. Ops gets ops. Sarah from finance stops getting delivery complaints.",
    meta: "round-robin + skill",
    icon: <IconRoute />,
  },
  {
    title: "Daily digest",
    detail:
      "One WhatsApp message every morning: what closed, what's still open, what's on fire. The team's standup, automated.",
    meta: "07:00 local time",
    icon: <IconSun />,
  },
  {
    title: "Self-hostable",
    detail:
      "Runs on a Postgres, your LLM keys, your VPS. No vendor lock-in, no data leaves your cloud. Or skip all that and use ours.",
    meta: "MIT · docker-compose",
    icon: <IconBox />,
  },
];

export function Features() {
  return (
    <section className="section">
      <div className="container-page">
        <div className="mb-16 grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-display-balance">A control room, not a chatbot.</h2>
          </div>
          <p className="self-end text-fg-secondary text-[1.0625rem]">
            Six core systems that turn a noisy inbox into a queue your team actually
            trusts. Use the ones you need.
          </p>
        </div>

        {/* Varied grid — no identical-card-grid reflex */}
        <div className="grid gap-px bg-[color:var(--ink-edge)] sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden border border-[color:var(--ink-edge)]">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="bg-[color:var(--ink-base)] p-7 md:p-8 transition-colors hover:bg-[color:var(--ink-raised)] group"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="text-[color:var(--brand-cyan)] transition-transform duration-300 group-hover:scale-110">
                  {f.icon}
                </div>
                <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-fg-muted">
                  {f.meta}
                </span>
              </div>
              <h3 className="text-[1.125rem] font-semibold tracking-[-0.015em] text-fg-primary mb-2">
                {f.title}
              </h3>
              <p className="text-[0.9375rem] leading-relaxed text-fg-tertiary">
                {f.detail}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Icons — custom inline SVG, no sketchy filler */
function IconBrain() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.4A3 3 0 0 0 5 8v1a3 3 0 0 0 1.5 2.6V13a3 3 0 0 0 3 3v.5A2.5 2.5 0 0 0 12 19a2.5 2.5 0 0 0 2.5-2.5V16a3 3 0 0 0 3-3v-1.4A3 3 0 0 0 19 9V8a3 3 0 0 0-2-2.8v-.7A2.5 2.5 0 0 0 14.5 2 2.5 2.5 0 0 0 12 4" />
    </svg>
  );
}
function IconDraft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconRoute() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h2" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
    </svg>
  );
}