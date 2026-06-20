import { NextRequest, NextResponse } from "next/server";

import { checkPassword, DEMO_PASSWORDS } from "../../../lib/passwords";
import { clearRoleCookie, setRoleCookie, type Role } from "../../../lib/auth";

export const dynamic = "force-dynamic";

function resolveBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) return req.nextUrl.origin;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const role = String(form.get("role") ?? "");
  const password = String(form.get("password") ?? "");
  const redirectTo = String(form.get("redirect") ?? "/app");
  const baseUrl = resolveBaseUrl(req);

  if (!(role in DEMO_PASSWORDS)) {
    return NextResponse.json({ error: "unknown role" }, { status: 400 });
  }
  if (!checkPassword(role, password)) {
    return NextResponse.redirect(new URL(`/gate?error=1&role=${role}&redirect=${encodeURIComponent(redirectTo)}`, baseUrl));
  }
  setRoleCookie(role as Role);
  return NextResponse.redirect(new URL(redirectTo || "/app", baseUrl));
}

export async function DELETE(req: NextRequest) {
  clearRoleCookie();
  return NextResponse.redirect(new URL("/landing", resolveBaseUrl(req)));
}