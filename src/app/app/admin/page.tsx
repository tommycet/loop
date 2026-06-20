import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { AuthorityRulesTable } from "../../../components/AuthorityRulesTable";
import { AuthorityRulesEditor } from "../../../components/admin/AuthorityRulesEditor";
import { AuditLog } from "../../../components/AuditLog";
import { TunnelStatus } from "../../../components/TunnelStatus";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/admin&needs=admin");
  if (role !== "admin") {
    redirect(`/gate?denied=${role}&needs=admin&redirect=/app/admin`);
  }
  return role;
}

export default function AdminConsolePage() {
  const role = gateOrRole();
  return (
    <AppShell
      role={role}
      title="Admin console"
      subtitle="Authority rules, escalations, and the audit trail. Admin role only."
    >
      <div className="space-y-6">
        <TunnelStatus />
        <AuthorityRulesEditor />
        <AuthorityRulesTable refreshKey={0} />
        <AuditLog refreshKey={0} />
      </div>
    </AppShell>
  );
}