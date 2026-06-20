"use client";

import { useEffect, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function RealtimeProvider({
  children,
  onUpdate,
}: {
  children: React.ReactNode;
  onUpdate?: () => void;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setEnabled(false);
      return;
    }

    let active = true;

    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const channel = supabase
        .channel("loop-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => onUpdate?.())
        .on("postgres_changes", { event: "*", schema: "public", table: "raw_messages" }, () => onUpdate?.())
        .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, () => onUpdate?.())
        .subscribe();

      if (active) {
        setEnabled(true);
      }

      return () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      active = false;
    };
  }, [onUpdate]);

  return (
    <>
      {children}
      {!enabled ? (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/55 backdrop-blur">
          Demo mode
        </div>
      ) : null}
    </>
  );
}
