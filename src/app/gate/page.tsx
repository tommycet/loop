import { redirect } from "next/navigation";

import { GateForm } from "../../components/GateForm";
import { GateBackground } from "../../components/landing/GateBackground";
import { currentRoleFromCookies } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default function GatePage({
  searchParams,
}: {
  searchParams: { error?: string; role?: string; redirect?: string; denied?: string; needs?: string };
}) {
  // If already signed in, bounce them into the dashboard.
  const current = currentRoleFromCookies();
  if (current && !searchParams.denied) {
    redirect(searchParams.redirect || "/app");
  }

  const presetRole = searchParams.role || "admin";
  const hasError = searchParams.error === "1";
  const deniedFrom = searchParams.denied;
  const requiredRoles = (searchParams.needs || "").split(",").filter(Boolean);

  return (
    <div className="min-h-screen bg-[color:var(--ink-base)] text-fg-primary">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl rounded-3xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)] p-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-6 flex items-center gap-3">
            <span className="text-[color:var(--brand-cyan)] text-2xl">◴</span>
            <span className="font-display text-xl font-semibold tracking-[-0.02em]">Loop</span>
            <span className="badge badge-cyan ml-2">access gate</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {deniedFrom
              ? "This page requires a higher-privilege role."
              : "Sign in to continue"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-fg-secondary">
            {deniedFrom
              ? `You're signed in as ${deniedFrom}. This page needs ${requiredRoles.join(" or ")} access.`
              : "The Commitment Control Plane uses a role gate to keep risky actions out of the wrong hands. Pick the role you want to demo and enter the demo password."}
          </p>

          {hasError && (
            <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
              Wrong password for {presetRole}. Check the demo passwords below.
            </div>
          )}

          <GateForm presetRole={presetRole} redirectTo={searchParams.redirect || "/app"} />

          <div className="mt-8 rounded-2xl border border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] p-5 text-xs text-fg-tertiary">
            <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-fg-muted">Demo passwords</div>
            <ul className="space-y-1 font-mono">
              <li><span className="text-fg-secondary">viewer / sales / operations / finance:</span> loop-demo</li>
              <li><span className="text-fg-secondary">admin:</span> loop-admin</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              This gate is a hackathon demo stand-in. A production deployment swaps this for
              Supabase Auth + row-level security. The cookie is signed only by the password check
              and lives 8 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}