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
  // Hackathon mode: no cookie → treat as admin so judges can use the demo
  // without signing up. The /gate page still exists for explicit role switching.
  const v: string | null = raw ?? "admin";
  return isRole(v) ? v : null;
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