import { NextResponse } from "next/server";

import { currentRoleFromCookies, ROLE_LABEL } from "../../../lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * Returns the current signed-in role (or null) so client components can
 * conditionally render role-gated controls (e.g. approve / reject buttons).
 *
 * Server-side authorization still happens at the API routes that mutate
 * state — this endpoint is purely for UI affordances.
 */
export async function GET() {
  const role = currentRoleFromCookies();
  return NextResponse.json({
    role,
    label: role ? ROLE_LABEL[role] : null,
    canDecideApprovals: role === "admin" || role === "sales" || role === "operations" || role === "finance",
  });
}
