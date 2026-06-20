import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { JobsBoard } from "../../../components/JobsBoard";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/jobs");
  return role!;
}

export default function JobsPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Jobs board" subtitle="Tasks and follow-ups assigned to your team.">
      <JobsBoard refreshKey={0} />
    </AppShell>
  );
}