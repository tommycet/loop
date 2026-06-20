import { NextResponse } from "next/server";
import { writeDemoState } from "../../../lib/demo-state";
import * as fs from "node:fs";
import * as path from "node:path";

export const dynamic = "force-dynamic";

export async function POST() {
  const statePath = path.join(process.cwd(), ".demo-state", "loop-demo-state.json");
  
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  
  return NextResponse.json({ ok: true, message: "Demo state reset. Fresh seed data will be generated on next request." });
}
