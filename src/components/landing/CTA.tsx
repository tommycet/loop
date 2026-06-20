import Link from "next/link";

export function CTA() {
  return (
    <section className="section">
      <div className="container-page">
        <div className="surface-card relative overflow-hidden p-12 md:p-20">
          {/* Background grid pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(var(--brand-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--brand-cyan) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            }}
          />

          <div className="relative max-w-2xl">
            <h2 className="text-display-balance">
              Stop running your ops on memory and goodwill.
            </h2>
            <p className="mt-5 text-[1.0625rem] text-fg-secondary leading-relaxed">
              Loop pays for itself the first time it catches a follow-up your team
              would have missed. Set up takes ten minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="btn btn-primary btn-lg">
                Open the live demo
              </Link>
              <Link href="/contact" className="btn btn-secondary btn-lg">
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}