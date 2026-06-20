"use client";

import { useEffect, useState } from "react";

type Step = {
  id: string;
  label: string;
  detail: string;
};

const STEPS: Step[] = [
  { id: "01", label: "Ingest", detail: "WhatsApp, email, voice notes. Pulled into one stream." },
  { id: "02", label: "Classify", detail: "AI separates noise from real work in under 800ms." },
  { id: "03", label: "Plan", detail: "Tasks, owners, deadlines. Drafted, never sent without review." },
  { id: "04", label: "Assign", detail: "Routed to your team by skill, workload, or shift." },
  { id: "05", label: "Follow up", detail: "If the ball drops, Loop nudges. After three misses, it escalates." },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="section">
      <div className="container-page">
        <div className="max-w-2xl mb-16">
          <h2 className="text-display-balance">Five steps. Zero missed follow-ups.</h2>
          <p className="mt-5 text-fg-secondary text-[1.0625rem]">
            The same pipeline a senior operations manager would run by hand. This one
            runs continuously, on every channel, and writes the receipts.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16 items-start">
          {/* Steps list — no numbered scaffolding, just named steps */}
          <ol className="space-y-1">
            {STEPS.map((step, i) => (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`group flex w-full items-start gap-5 rounded-lg border px-5 py-5 text-left transition-all duration-300 ${
                    i === active
                      ? "border-[color:var(--brand-cyan-soft)] bg-[color:var(--ink-raised)]"
                      : "border-transparent hover:border-[color:var(--ink-edge)]"
                  }`}
                >
                  <span
                    className={`font-mono text-[0.6875rem] tracking-[0.12em] mt-1.5 transition-colors ${
                      i === active ? "text-[color:var(--brand-cyan)]" : "text-fg-muted"
                    }`}
                  >
                    {step.id}
                  </span>
                  <div className="flex-1">
                    <div
                      className={`text-[1.0625rem] font-semibold transition-colors ${
                        i === active ? "text-fg-primary" : "text-fg-secondary group-hover:text-fg-primary"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="mt-1.5 text-[0.875rem] text-fg-tertiary leading-relaxed">
                      {step.detail}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ol>

          {/* Visual */}
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)]">
            <FlowDiagram active={active} />
            <div className="absolute bottom-4 left-4 font-mono text-[0.6875rem] tracking-[0.12em] text-fg-muted">
              {STEPS[active].label.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowDiagram({ active }: { active: number }) {
  return (
    <svg viewBox="0 0 520 420" className="absolute inset-0 h-full w-full">
      {/* Channel inputs */}
      <g transform="translate(20, 30)">
        {["WhatsApp", "Email", "Voice"].map((ch, i) => (
          <g key={ch} transform={`translate(0, ${i * 64})`}>
            <rect
              width="100"
              height="52"
              rx="8"
              fill="var(--ink-raised)"
              stroke={i === active % 3 ? "var(--brand-cyan)" : "var(--ink-edge)"}
              strokeWidth={i === active % 3 ? 1.5 : 1}
            />
            <text x="50" y="28" textAnchor="middle" fontSize="12" fill="var(--fg-secondary)" fontFamily="var(--font-mono)">
              {ch}
            </text>
            <text x="50" y="44" textAnchor="middle" fontSize="9" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
              {i === 0 ? "23 new" : i === 1 ? "8 new" : "2 new"}
            </text>
          </g>
        ))}
      </g>

      {/* Ingest node */}
      <g transform="translate(160, 130)">
        <rect width="100" height="60" rx="8" fill="var(--ink-raised)" stroke={active === 0 ? "var(--brand-cyan)" : "var(--ink-edge)"} strokeWidth={active === 0 ? 1.5 : 1} />
        <text x="50" y="34" textAnchor="middle" fontSize="12" fill="var(--fg-primary)" fontWeight="600">
          Ingest
        </text>
        <text x="50" y="50" textAnchor="middle" fontSize="9" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          queue: 33
        </text>
      </g>

      {/* AI classifier */}
      <g transform="translate(300, 130)">
        <rect width="100" height="60" rx="8" fill="var(--ink-raised)" stroke={active === 1 ? "var(--brand-cyan)" : "var(--ink-edge)"} strokeWidth={active === 1 ? 1.5 : 1} />
        <text x="50" y="30" textAnchor="middle" fontSize="12" fill="var(--fg-primary)" fontWeight="600">
          AI
        </text>
        <text x="50" y="44" textAnchor="middle" fontSize="9" fill="var(--signal-violet)" fontFamily="var(--font-mono)">
          classify
        </text>
        <text x="50" y="55" textAnchor="middle" fontSize="9" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          92% conf
        </text>
      </g>

      {/* Plan node */}
      <g transform="translate(300, 270)">
        <rect width="100" height="60" rx="8" fill="var(--ink-raised)" stroke={active === 2 ? "var(--brand-cyan)" : "var(--ink-edge)"} strokeWidth={active === 2 ? 1.5 : 1} />
        <text x="50" y="30" textAnchor="middle" fontSize="12" fill="var(--fg-primary)" fontWeight="600">
          Plan
        </text>
        <text x="50" y="48" textAnchor="middle" fontSize="9" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          tasks: 12
        </text>
      </g>

      {/* Assign node */}
      <g transform="translate(160, 270)">
        <rect width="100" height="60" rx="8" fill="var(--ink-raised)" stroke={active === 3 ? "var(--brand-cyan)" : "var(--ink-edge)"} strokeWidth={active === 3 ? 1.5 : 1} />
        <text x="50" y="30" textAnchor="middle" fontSize="12" fill="var(--fg-primary)" fontWeight="600">
          Assign
        </text>
        <text x="50" y="48" textAnchor="middle" fontSize="9" fill="var(--fg-muted)" fontFamily="var(--font-mono)">
          to 4 people
        </text>
      </g>

      {/* Follow-up node */}
      <g transform="translate(20, 290)">
        <rect width="100" height="60" rx="8" fill="var(--ink-raised)" stroke={active === 4 ? "var(--brand-cyan)" : "var(--ink-edge)"} strokeWidth={active === 4 ? 1.5 : 1} />
        <text x="50" y="30" textAnchor="middle" fontSize="12" fill="var(--fg-primary)" fontWeight="600">
          Follow-up
        </text>
        <text x="50" y="48" textAnchor="middle" fontSize="9" fill="var(--signal-warn)" fontFamily="var(--font-mono)">
          3 pending
        </text>
      </g>

      {/* Lines */}
      <g stroke="var(--brand-cyan-soft)" strokeWidth="1" fill="none" opacity="0.7">
        {/* WhatsApp → Ingest */}
        <line x1="120" y1="56" x2="160" y2="160" />
        {/* Email → Ingest */}
        <line x1="120" y1="120" x2="160" y2="160" />
        {/* Voice → Ingest */}
        <line x1="120" y1="184" x2="160" y2="160" />
        {/* Ingest → AI */}
        <line x1="260" y1="160" x2="300" y2="160" />
        {/* AI → Plan */}
        <line x1="350" y1="190" x2="350" y2="270" />
        {/* Plan → Assign */}
        <line x1="300" y1="300" x2="260" y2="300" />
        {/* Assign → Follow-up */}
        <line x1="160" y1="300" x2="120" y2="320" />
      </g>

      {/* Pulsing dot at active step */}
      <circle
        cx={active === 0 ? 210 : active === 1 ? 350 : active === 2 ? 350 : active === 3 ? 210 : 70}
        cy={active === 4 ? 320 : 160}
        r="4"
        fill="var(--brand-cyan)"
      >
        <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}