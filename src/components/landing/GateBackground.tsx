"use client";

import { useEffect, useState } from "react";

/**
 * Gate page background — a very subtle ambient glow.
 * No animation, no drift. The gate page is a single form; the visual must
 * support, not distract.
 */
export function GateBackground() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[color:var(--ink-deep)]"
    >
      <img
        src="/landing/gate-bg.webp"
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
        style={
          reduced
            ? {}
            : {
                animation: "hero-drift 80s ease-in-out infinite alternate",
                transformOrigin: "center center",
              }
        }
      />
    </div>
  );
}
