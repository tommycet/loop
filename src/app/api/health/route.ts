import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    app: "loop",
    mode: hasSupabaseEnv() ? "live" : "demo",
    publicUrl: process.env.LOOP_PUBLIC_URL ?? null,
    env: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      wappfly: Boolean(process.env.WAPPFLY_API_KEY),
      inngest: Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      slackSigning: Boolean(process.env.SLACK_SIGNING_SECRET),
      slackBot: Boolean(process.env.SLACK_BOT_TOKEN),
      slackSocket: Boolean(process.env.SLACK_APP_TOKEN),
      emailSecret: Boolean(process.env.EMAIL_WEBHOOK_SECRET),
    },
    serverTime: new Date().toISOString(),
  });
}
