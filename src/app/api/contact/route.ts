import { NextRequest, NextResponse } from "next/server";
import { safeSupabase } from "@/lib/runtime";
import { readDemoState, writeDemoState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

type ContactSubmission = {
  name?: string;
  email?: string;
  company?: string;
  message?: string;
};

// POST /api/contact — store contact form submission
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ContactSubmission;
  const { name, email, company, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json(
      { ok: false, error: "name, email, and message are required" },
      { status: 400 },
    );
  }

  const submission = {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    company: company || null,
    message,
    received_at: new Date().toISOString(),
  };

  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState() as any;
    if (!state.contact_submissions) state.contact_submissions = [];
    state.contact_submissions.unshift(submission);
    writeDemoState(state);
    return NextResponse.json({ ok: true, mode: "demo", submission });
  }

  // Live mode: log it (no dedicated table; reuse raw_messages-style insert for traceability)
  // In production this would route to email / CRM. Here we acknowledge and log.
  console.log("[contact]", submission);
  return NextResponse.json({ ok: true, mode: "live", submission });
}

// GET /api/contact — list submissions (dev tool)
export async function GET() {
  const supabase = safeSupabase();
  if (!supabase) {
    const state = readDemoState() as any;
    return NextResponse.json({ ok: true, mode: "demo", submissions: state.contact_submissions || [] });
  }
  // No table in production — return empty
  return NextResponse.json({ ok: true, mode: "live", submissions: [] });
}