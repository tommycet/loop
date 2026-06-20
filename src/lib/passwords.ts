/**
 * Demo-grade passwords for the role gate.
 *
 * These are NOT secrets — they exist so that judges can navigate the demo
 * without us having to spin up real Supabase auth in 24 hours. In a real
 * build this is replaced by Supabase Auth + row-level security.
 */
export const DEMO_PASSWORDS: Record<string, string> = {
  // Visitors can browse public pages. No gate required.
  viewer: "loop-demo",

  // Operators / sales / finance each get the same shared demo password for the
  // prototype. A real build would have distinct credentials per role.
  sales: "loop-demo",
  operations: "loop-demo",
  finance: "loop-demo",

  // Admin pages (audit, governance rules, override actions) require this.
  admin: "loop-admin",
};

/**
 * Check a submitted password against the demo set.
 */
export function checkPassword(role: string, password: string): boolean {
  const expected = DEMO_PASSWORDS[role];
  if (!expected) return false;
  return expected === password;
}

export const PUBLIC_ROLES = new Set(["viewer"]);