import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/settings");
  return role!;
}

const integrations = [
  { name: "WhatsApp (Wappfly)", status: "Connected", detail: "Session 362 · last poll 12 min ago" },
  { name: "Groq (LLM planner)", status: "Connected", detail: "llama-3.3-70b-versatile" },
  { name: "OpenRouter (fallback)", status: "Connected", detail: "qwen/qwen-2.5-72b-instruct" },
  { name: "Supabase (Postgres)", status: "Connected", detail: "skucqwqptusyyoxegqpk.supabase.co" },
  { name: "Resend (email out)", status: "Connected", detail: "loop-ops domain" },
  { name: "Inngest (background jobs)", status: "Connected", detail: "10 functions registered" },
];

export default function SettingsPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Settings" subtitle="Workspace, integrations, and account.">
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-[#0c0f17] p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">workspace</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Loop Operations Labs</h2>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-[10px] uppercase tracking-[0.24em] text-white/45">Plan</dt>
              <dd className="mt-1 text-sm font-semibold text-white">Hackathon demo</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-[10px] uppercase tracking-[0.24em] text-white/45">Region</dt>
              <dd className="mt-1 text-sm font-semibold text-white">ap-northeast-1</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-[10px] uppercase tracking-[0.24em] text-white/45">Database</dt>
              <dd className="mt-1 font-mono text-xs text-white/80">skucqwqptusyyoxegqpk.supabase.co</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-[10px] uppercase tracking-[0.24em] text-white/45">Signed in as</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-white">{role}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#0c0f17] p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">integrations</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Connected services</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {integrations.map((i) => (
              <div key={i.name} className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{i.name}</span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                    {i.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/55">{i.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}