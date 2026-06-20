import { NextResponse } from "next/server";
import { getRecentMessages } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const messages = await getRecentMessages(20);
    return NextResponse.json({ ok: true, messages });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
