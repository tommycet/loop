import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { CommitmentLedger } from "../../../components/CommitmentLedger";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/commitments");
  return role!;
}

export default function CommitmentsPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Commitment ledger" subtitle="Every promise detected, ranked by risk and status.">
      <CommitmentLedger refreshKey={0} />
    </AppShell>
  );
}