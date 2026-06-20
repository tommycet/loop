import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = await getSessionInfo();
    return NextResponse.json({
      ok: true,
      session: info.session,
      quota: info.user.quota,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
