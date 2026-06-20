"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero background layer.
 *
 * Stack (bottom → top):
 *   1. Solid ink-base fallback color (no flash on slow connections)
 *   2. Static WebP image — always present. Acts as:
 *        a. `poster` for the <video> element
 *        b. Reduced-motion fallback
 *        c. Broken-video / 404 fallback (if the mp4/webm are missing)
 *   3. <video> — when present + autoplayable, overlays the static image and
 *      hides it. CSS drift still applies so video and image stay in lockstep.
 *   4. Particle overlay (transparent PNG) with reversed drift, screen blend
 *   5. Radial vignette darkening center for headline legibility
 *   6. Bottom fade so the section blends into the next
 *
 * Video sources are listed WebM first (smaller, better quality), then MP4
 * fallback for Safari iOS and older browsers. Both are autoplay-muted-loop
 * so no user gesture is required.
 *
 * To drop in a new hero video later, replace these two files in /public/landing/:
 *   - hero-bg.webm   (preferred)
 *   - hero-bg.mp4    (Safari fallback)
 * Keep duration 8–14s and ensure the last frame matches the first (seamless loop).
 */
export function HeroBackground() {
  const [reduced, setReduced] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Try to play the video when the component mounts (only if motion allowed).
  // If the file is missing or codec unsupported, the video stays hidden and
  // the static WebP underneath is what the user sees.
  useEffect(() => {
    if (reduced) return;
    const v = videoRef.current;
    if (!v) return;

    const onReady = () => setVideoReady(true);
    const onError = () => setVideoReady(false);

    v.addEventListener("canplay", onReady);
    v.addEventListener("error", onError);

    // Some browsers refuse autoplay even when muted; we don't surface that
    // as an error, just keep the static fallback showing.
    v.play().catch(() => setVideoReady(false));

    return () => {
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("error", onError);
    };
  }, [reduced]);

  // CSS drift animations. Same keyframes for image and video so they
  // stay registered even when one of them isn't visible.
  const imageStyle: React.CSSProperties = reduced
    ? {}
    : {
        animation: "hero-drift 48s ease-in-out infinite alternate",
        transformOrigin: "center center",
        willChange: "transform",
      };

  const videoStyle: React.CSSProperties = {
    animation: "hero-drift 48s ease-in-out infinite alternate",
    transformOrigin: "center center",
    willChange: "transform",
  };

  const particlesStyle: React.CSSProperties = reduced
    ? { mixBlendMode: "screen", opacity: 0.45 }
    : {
        mixBlendMode: "screen",
        opacity: 0.45,
        animation: "hero-drift-rev 72s ease-in-out infinite alternate",
        willChange: "transform",
      };

  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 overflow-hidden bg-[color:var(--ink-deep)]"
    >
      {/* Layer 2: static WebP — always present as fallback */}
      <img
        src="/landing/hero-bg.webp"
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
        style={videoReady ? { ...imageStyle, opacity: 0 } : imageStyle}
      />

      {/* Layer 3: video — only renders when motion allowed and loaded */}
      {!reduced && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/landing/hero-bg.webp"
          className="absolute inset-0 h-full w-full object-cover"
          style={videoReady ? videoStyle : { display: "none" }}
        >
          <source src="/landing/hero-bg.webm" type="video/webm" />
          <source src="/landing/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* Layer 4: particles overlay */}
      <img
        src="/landing/hero-particles.png"
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        style={particlesStyle}
      />

      {/* Layer 5: center vignette for headline contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 30% 55%, oklch(0.05 0.008 250 / 0.55) 0%, oklch(0.05 0.008 250 / 0.2) 55%, transparent 85%)",
        }}
      />

      {/* Layer 6: bottom fade into next section */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--ink-base))",
        }}
      />
    </div>
  );
}
