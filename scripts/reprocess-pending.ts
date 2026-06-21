// scripts/reprocess-pending.ts
// One-off: re-fire message.received events for all pending raw_messages,
// so the Inngest function picks them up and the AI classifier runs.
//
// Usage: cd /root/loop && npx tsx scripts/reprocess-pending.ts

import { Inngest } from "inngest";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const inngest = new Inngest({ id: "loop-agent" });

async function main() {
  const supabase = createClient(supabaseUrl, srk, { auth: { persistSession: false } });

  const { data: pending, error } = await supabase
    .from("raw_messages")
    .select("id, channel, contact_id, created_at, audio_url")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("query error:", error);
    process.exit(1);
  }
  if (!pending || pending.length === 0) {
    console.log("no pending messages");
    return;
  }

  console.log(`firing message.received for ${pending.length} pending messages...`);
  for (const m of pending) {
    await inngest.send({
      name: "message.received",
      data: {
        messageId: m.id,
        contactId: m.contact_id,
        channel: m.channel,
        isVoice: Boolean(m.audio_url),
      },
    });
    console.log(`  fired: ${m.id.slice(0, 8)}  (${m.created_at})`);
  }
  console.log("done — Inngest will process them in the next few seconds");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
