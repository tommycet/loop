import { cookies } from "next/headers";

import { isRole, type Role } from "./auth-types";

/**
 * Server-only auth helpers. Anything that touches `next/headers` lives
 * here so client components can safely import the auth-types module.
 */

const COOKIE = "loop_role";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export function currentRoleFromCookies(): Role | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  return isRole(raw) ? raw : null;
}

/**
 * Hackathon convenience: for non-gated pages (landing, docs) we want to
 * know the current role for display. If no cookie is set, return "admin"
 * as the display default. NEVER use this for authorization decisions —
 * use currentRoleFromCookies() for that, and redirect to /gate if null.
 */
export function currentRoleForDisplay(): Role {
  return currentRoleFromCookies() ?? "admin";
}

export function setRoleCookie(role: Role) {
  cookies().set(COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearRoleCookie() {
  cookies().delete(COOKIE);
}

export { ROLE_LABEL } from "./auth-types";
export type { Role } from "./auth-types";
