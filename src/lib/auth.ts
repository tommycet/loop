/**
 * Re-export for backwards compatibility with existing imports.
 *
 * New code should import from `./auth-types`, `./auth-server`, or
 * `./auth-client` depending on what it needs.
 */

export type { Role } from "./auth-types";
export { ROLE_LABEL } from "./auth-types";
export { currentRoleFromCookies, currentRoleForDisplay, setRoleCookie, clearRoleCookie } from "./auth-server";