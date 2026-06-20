/**
 * Shared auth types. Imported by both server (auth-server.ts) and
 * client (auth-client.ts) modules.
 */

export type Role = "viewer" | "admin" | "finance" | "operations" | "sales";

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Viewer",
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
};

export function isRole(value: string | null | undefined): value is Role {
  return value === "viewer" || value === "admin" || value === "finance" || value === "operations" || value === "sales";
}