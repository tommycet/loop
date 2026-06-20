"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  channel: string;
  direction: string;
  content?: string | null;
  status: string;
  created_at: string;
};

export function MessageFeed({ refreshKey }: { refreshKey: number }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    fetch("/api/messages", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [refreshKey]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0a1017] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">incoming signal</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Message feed</h2>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-200">
          live ingest
        </div>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/45">
            No messages yet. Send a WhatsApp/email event or seed demo data in Supabase.
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <div className="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em] text-white/35">
                <span>{message.channel}</span>
                <span>{message.status}</span>
              </div>
              <p className="text-sm leading-6 text-white/85">
                {message.content?.trim() || "[media or voice message]"}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
