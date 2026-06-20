type EvidenceCard = {
  claim: string;
  quote: string;
  source: string;
  sourceUrl: string;
  takeaway: string;
};

const EVIDENCE: EvidenceCard[] = [
  {
    claim: "WhatsApp already runs the business",
    quote:
      "Across India and most emerging markets, the majority of SMBs running between 10 and 200 people are managing core business operations on a combination of Excel spreadsheets, WhatsApp groups, and email threads.",
    source: "Scrrum Labs, 2026",
    sourceUrl: "https://scrrum.com/blog/your-business-runs-on-excel-and-whatsapp-that-s-not-a-starting-point",
    takeaway:
      "Commitments get made in chat. Loop adds the control plane that chat itself is missing.",
  },
  {
    claim: "Workers lose 9% of the week to context switching",
    quote:
      "Workers toggled roughly 1,200 times each day, which adds up to just under four hours each week reorienting themselves after toggling — roughly 9% of their time at work.",
    source: "Harvard Business Review, Aug. 29, 2022",
    sourceUrl: "https://hbr.org/2022/08/how-much-time-and-energy-do-we-waste-toggling-between-applications",
    takeaway:
      "Live where the work already happens — WhatsApp, email, voice — instead of demanding another tab.",
  },
  {
    claim: "Informal follow-up is the real bottleneck",
    quote:
      "Execution slows because too much relies on informal follow-up and individual heroics.",
    source: "The Alternative Board, 2025",
    sourceUrl: "https://www.thealternativeboard.co.uk/insights/why-accountability-breaks-down-as-businesses-grow-and-how-to-fix-it",
    takeaway:
      "Ownerless promises and ownerless customers are the failure mode Loop is built to prevent.",
  },
  {
    claim: "Manual voice-note triage eats the day",
    quote:
      "Listen to 5-minute client voice message… Type notes into CRM while listening (15–20 min total)… No searchability across conversations.",
    source: "VOCAP, 2026",
    sourceUrl: "https://vocap.io/en/blog/transcribe-whatsapp-business-voice-messages-crm-ai",
    takeaway:
      "Voice notes become structured commitments with owners and risk tiers — no second listener required.",
  },
  {
    claim: "Bad operational data is expensive",
    quote:
      "Poor data quality costs organizations at least $12.9 million a year on average.",
    source: "Gartner Data Quality",
    sourceUrl: "https://www.gartner.com/en/data-analytics/topics/data-quality",
    takeaway:
      "Capture once at the source so reports stop being compiled by hand three days later.",
  },
  {
    claim: "Agentic AI is timing-right — but most projects will fail",
    quote:
      "Over 40% of agentic AI projects will be canceled by the end of 2027, due to escalating costs, unclear business value or inadequate risk controls.",
    source: "Gartner, June 25, 2025",
    sourceUrl: "https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027",
    takeaway:
      "Tie the agent to a workflow you can name, with audit and override — not a generic 'AI helper'.",
  },
];

export function Testimonials() {
  return (
    <section className="section">
      <div className="container-page">
        <div className="max-w-2xl mb-12">
          <div className="text-eyebrow text-[color:var(--brand-cyan)] mb-4">evidence</div>
          <h2 className="text-display-balance">
            Why informal chat needs a control plane.
          </h2>
          <p className="mt-5 text-fg-secondary text-[1.0625rem]">
            Six independent sources, in the operators' own words. Loop is built around
            the failure modes they describe.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {EVIDENCE.map((e) => (
            <figure
              key={e.claim}
              className="surface-card flex flex-col gap-5 p-6 transition-colors hover:bg-[color:var(--ink-edge)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--brand-cyan)]">
                  {e.claim}
                </span>
              </div>
              <blockquote className="flex-1 text-[0.9375rem] leading-relaxed text-fg-secondary">
                <span aria-hidden className="text-[color:var(--brand-cyan)]">“</span>
                {e.quote}
                <span aria-hidden className="text-[color:var(--brand-cyan)]">”</span>
              </blockquote>
              <a
                href={e.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted hover:text-fg-primary"
              >
                — {e.source}
              </a>
              <p className="border-t border-[color:var(--ink-edge)] pt-3 text-[12px] leading-relaxed text-fg-tertiary">
                {e.takeaway}
              </p>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}