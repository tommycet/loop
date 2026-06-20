import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { to, text } = await req.json();
    if (!to || !text) {
      return NextResponse.json({ ok: false, error: "to and text are required" }, { status: 400 });
    }
    const result = await sendMessage(to, text);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
