"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Armed mode hides content until intersected. Without it, content is visible by default. */
  armed?: boolean;
  as?: keyof JSX.IntrinsicElements;
};

/**
 * Reveal enhances an already-visible default with a 600ms ease-out-quart fade+rise
 * when the element enters the viewport. With `armed`, it gates visibility on
 * intersection — used sparingly for first-fold hero content.
 *
 * Respects `prefers-reduced-motion` via globals.css (instant transition).
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  armed = false,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!armed || !ref.current) return;
    const el = ref.current;
    el.dataset.armed = "true";

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            window.setTimeout(() => el.classList.add("is-visible"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed, delay]);

  const props = armed ? { "data-armed": "true" } : {};

  return (
    // @ts-expect-error — generic ref typing
    <Tag ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined} {...props}>
      {children}
    </Tag>
  );
}