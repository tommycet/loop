import type { Role } from "./auth-types";

/**
 * Client-safe auth helpers. No `next/headers` imports here — anything
 * that needs to read/write cookies belongs in `auth-server.ts`.
 */

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Viewer",
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
};

/**
 * Stub the client uses. The actual cookie clear happens via POST/DELETE
 * to /api/gate so the httpOnly cookie is cleared server-side.
 */
export function clearRoleCookieClient() {
  // No-op; the UI calls fetch("/api/gate", { method: "DELETE" }).
}

export type { Role };