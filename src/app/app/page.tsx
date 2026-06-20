import { redirect } from "next/navigation";

import { AppShell } from "../../components/AppShell";
import { CommitmentLedger } from "../../components/CommitmentLedger";
import { DashboardStats } from "../../components/DashboardStats";
import { AuditTimeline } from "../../components/AuditTimeline";
import { AuthorityQueue } from "../../components/AuthorityQueue";
import { currentRoleFromCookies } from "../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app");
  return role!;
}

export default function AppOverview() {
  const role = gateOrRole();
  return (
    <AppShell
      role={role}
      title="Commitment Control Plane"
      subtitle="Every promise made in chat, ranked and assigned."
    >
      <div className="space-y-6">
        <DashboardStats refreshKey={0} />
        <CommitmentLedger refreshKey={0} />
        <div className="grid gap-6 lg:grid-cols-2">
          <AuthorityQueue refreshKey={0} />
          <AuditTimeline refreshKey={0} />
        </div>
      </div>
    </AppShell>
  );
}