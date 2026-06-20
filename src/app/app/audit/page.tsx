import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { AuditLog } from "../../../components/AuditLog";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const AUDIT_ROLES = ["viewer", "finance", "admin"] as const;

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/audit&needs=finance,admin,viewer");
  if (!AUDIT_ROLES.includes(role as (typeof AUDIT_ROLES)[number])) {
    redirect(`/gate?denied=${role}&needs=finance,admin,viewer&redirect=/app/audit`);
  }
  return role!;
}

export default function AuditPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Audit log" subtitle="Every commitment action, who did it, why.">
      <AuditLog refreshKey={0} />
    </AppShell>
  );
}