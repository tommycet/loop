import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { TeamWorkload } from "../../../components/TeamWorkload";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/team");
  return role!;
}

export default function TeamPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Team workload" subtitle="Open loops, jobs, and queue depth by role.">
      <TeamWorkload refreshKey={0} />
    </AppShell>
  );
}