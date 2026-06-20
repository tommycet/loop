import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { TunnelStatus } from "../../../components/TunnelStatus";
import { FlowBuilder } from "../../../components/flows/FlowBuilder";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/flows");
  return role!;
}

export default function FlowsPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Flows" subtitle="Visual automation for commitment routing.">
      <div className="space-y-6">
        <TunnelStatus />
        <FlowBuilder />
      </div>
    </AppShell>
  );
}