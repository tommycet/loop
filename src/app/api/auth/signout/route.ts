import { NextRequest, NextResponse } from "next/server";

import { clearRoleCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function resolveBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) return req.nextUrl.origin;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  clearRoleCookie();
  return NextResponse.redirect(
    new URL("/gate?signed_out=1", resolveBaseUrl(req)),
    { status: 303 },
  );
}

export async function GET(req: NextRequest) {
  // Allow GET-based sign-out too (e.g. <a href="/api/auth/signout">) for
  // convenience. Same behavior: clear cookie, redirect to the gate.
  clearRoleCookie();
  return NextResponse.redirect(
    new URL("/gate?signed_out=1", resolveBaseUrl(req)),
  );
}
