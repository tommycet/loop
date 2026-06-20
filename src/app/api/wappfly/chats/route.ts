import { NextResponse } from "next/server";
import { getChats } from "@/lib/wappfly";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const chats = await getChats();
    return NextResponse.json({ ok: true, chats });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
