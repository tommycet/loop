import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { AuthorityQueue } from "../../../components/AuthorityQueue";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/authority");
  return role!;
}

export default function AuthorityPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Authority queue" subtitle="Commitments waiting for a human sign-off.">
      <AuthorityQueue refreshKey={0} />
    </AppShell>
  );
}