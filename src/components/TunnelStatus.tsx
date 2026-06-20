"use client";

import { useEffect, useState } from "react";

type Health = "checking" | "live" | "down";

export function TunnelStatus({ defaultUrl }: { defaultUrl?: string }) {
  const [url, setUrl] = useState<string>(defaultUrl ?? "");
  const [health, setHealth] = useState<Health>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const start = performance.now();
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const elapsed = Math.round(performance.now() - start);
        if (cancelled) return;
        if (!r.ok) {
          setHealth("down");
          setLatency(null);
          return;
        }
        const data = (await r.json()) as { tunnelUrl?: string };
        setUrl(data.tunnelUrl ?? defaultUrl ?? "");
        setHealth("live");
        setLatency(elapsed);
      } catch {
        if (cancelled) return;
        setHealth("down");
        setLatency(null);
      }
    };
    check();
    const t = window.setInterval(check, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [defaultUrl]);

  const webhookUrl = url
    ? `${url.replace(/\/$/, "")}/api/inbound/{telegram,slack,email,whatsapp-meta}`
    : "—";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={
              "h-2 w-2 rounded-full " +
              (health === "live"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                : health === "down"
                  ? "bg-rose-500"
                  : "bg-zinc-600 animate-pulse")
            }
          />
          <span className="font-mono uppercase tracking-[0.18em] text-zinc-400">
            Tunnel {health}
            {latency !== null ? ` · ${latency}ms` : ""}
          </span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr] sm:items-center">
        <span className="font-mono uppercase tracking-[0.18em] text-zinc-500">
          Public URL
        </span>
        <code className="break-all rounded bg-zinc-900 px-2 py-1 text-zinc-100">
          {url || "—"}
        </code>
        <span className="font-mono uppercase tracking-[0.18em] text-zinc-500">
          Webhook
        </span>
        <code className="break-all rounded bg-zinc-900 px-2 py-1 text-zinc-100">
          {webhookUrl}
        </code>
      </div>
    </div>
  );
}
