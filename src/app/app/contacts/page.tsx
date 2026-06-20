import { redirect } from "next/navigation";

import { AppShell } from "../../../components/AppShell";
import { ContactsList } from "../../../components/ContactsList";
import { currentRoleFromCookies } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function gateOrRole(): string {
  const role = currentRoleFromCookies();
  if (!role) redirect("/gate?redirect=/app/contacts");
  return role!;
}

export default function ContactsPage() {
  const role = gateOrRole();
  return (
    <AppShell role={role} title="Contacts" subtitle="Every person Loop has captured from WhatsApp, email, and voice.">
      <ContactsList refreshKey={0} />
    </AppShell>
  );
}